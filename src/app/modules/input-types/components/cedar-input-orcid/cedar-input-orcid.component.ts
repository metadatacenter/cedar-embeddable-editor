import { ChangeDetectionStrategy, Component, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { catchLookupFailure } from '../../../shared/util/lookup-failure';
import { ErrorStateMatcher } from '@angular/material/core';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, tap, catchError, finalize } from 'rxjs/operators';
import { ExternalAuthorityLookupService } from '../../../shared/service/external-authority-lookup.service';
import { authorityDescriptorFor } from '../../../shared/models/authority/authority-descriptor.model';
import { InputType } from '../../../shared/models/input-type.model';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { OrcidTerm } from '../../../shared/models/authority/orcid-term.model';
import { OrcidResolveResponse, ResearcherDetails } from '../../../shared/models/rest/orcid-detail/orcid-detail-person';
import { isAuthorityTerm } from '../../../shared/models/authority/authority-term.guard';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-orcid',
  templateUrl: './cedar-input-orcid.component.html',
  styleUrls: ['./cedar-input-orcid.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CedarInputOrcidComponent extends CedarUIDirective implements OnInit {
  /**
   * Undefined until the view exists, and for good in read-only mode — the
   * autocomplete input the trigger reads sits behind an `@if` on it. ORCID and
   * ROR already tested for that; the other two reached through it inside a
   * `!readOnlyMode` guard, which is the same fact stated less directly.
   */
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger })
  trigger?: MatAutocompleteTrigger;

  selectedData: OrcidTerm | null = null;
  component!: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl<string | null>(null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  @Input({ required: true }) handlerContext!: HandlerContext;
  model: OrcidTerm | null = null;
  researcherDetails: ResearcherDetails | null = null;
  showDetails = false;

  loadingOptions = false;
  hasSearched = false;
  loadingDetails = false;
  /** Whether the last search failed, as opposed to returning nothing. */
  lookupFailed = false;

  /**
   * An empty list until `ngOnInit` builds the search pipeline, and for good in
   * read-only mode, where there is no autocomplete to feed. A real observable
   * rather than nothing, so the template's async pipe always has one to read.
   */
  filteredOptions: Observable<OrcidTerm[]> = of([]);
  private researcherDetailsCache = new Map<string, ResearcherDetails>();
  justReverted = false;
  justCleared = false;
  selectionInProgress = false;

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private lookup: ExternalAuthorityLookupService,
  ) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }

  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    const validators = [];
    if (this.component?.valueInfo?.requiredValue) {
      validators.push(Validators.required);
    }
    // Deliberately no `CedarValidators.forComponent` here. This control holds what
    // the user is typing, and after a selection it holds "Label - https://iri";
    // the IRI itself only ever reaches the model. Validating the control as
    // though it were the field's value rejects every intermediate state, which
    // put "not a valid ... and has been cleared" under the field on the first
    // keystroke, over a field that had not been cleared. The stored IRI is
    // checked by the data quality report, which sees the value rather than the
    // search text; the discarded-edit error is raised explicitly on blur.
    this.inputValueControl = new FormControl<string | null>(null, validators);
    // A default on one of these fields is a term, not text. Guarded rather than
    // asserted: a template declaring a bare string here would otherwise read as a
    // term with two undefined halves.
    const declaredDefault = this.component?.valueInfo?.defaultValue ?? null;
    if (isAuthorityTerm(declaredDefault)) {
      this.updateValue(declaredDefault.iri || null, declaredDefault.label || null);
    }
    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((val) => {
          const isSame = this.selectedData && val === this.getCompoundValue(this.selectedData);
          if (isSame) {
            this.loadingOptions = false;
            this.cdr.markForCheck();
            // `[this.selectedData]` only when there is one; `isSame` above already
            // required it, which the compiler cannot see through the `&&`.
            return of(this.selectedData === null ? [] : [this.selectedData]);
          }
          this.lookupFailed = false;
          return this.filter(val || '').pipe(
            // A failed search and an empty one both used to arrive here as an
            // empty list, and the panel called both "No results found". Recorded
            // so the template can tell the user which of the two happened.
            catchLookupFailure<OrcidTerm>((error) => {
              this.lookupFailed = true;
              console.error(`CEE ERROR: ORCID lookup failed for "${val}"`, error);
            }),
            finalize(() => {
              this.loadingOptions = false;
              this.hasSearched = true;
              this.cdr.markForCheck();
            }),
          );
        }),
        tap(() => {
          setTimeout(() => {
            const panel = this.trigger?.autocomplete?.panel?.nativeElement as HTMLElement;
            if (panel) panel.scrollTop = 0;
          });
        }),
      );
    }
  }
  private getCompoundValue(option: OrcidTerm | null): string {
    if (!option) {
      return '';
    }
    const label = option.label ? option.label.trim() : '';
    const id = option.iri ? option.iri.trim() : '';
    return `${label} - ${id}`;
  }
  private filter(val: string): Observable<OrcidTerm[]> {
    if (!val) {
      return of([]);
    }
    if (this.descriptor.looksLikeIdentifier(val)) {
      return this.lookup.resolve<OrcidResolveResponse>(InputType.orcid, val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          }
          const details = ResearcherDetails.fromJson(response);
          const item: OrcidTerm = { iri: response.id, label: response.name, researcherDetails: details };
          this.researcherDetailsCache.set(response.id, details);
          return [item];
        }),
      );
    } else {
      return this.lookup.search(InputType.orcid, val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          }
          return response.results;
        }),
      );
    }
  }
  private updateValue(atId: string | null, prefLabel: string | null): void {
    if (!prefLabel) {
      return;
    }
    this.inputValueControl.setValue(prefLabel, { emitEvent: false });
    this.handlerContext.changeControlledValue(this.component, atId, prefLabel);
  }
  onSelectionChange(option: OrcidTerm): void {
    if (!option) return;
    this.selectionInProgress = false;
    this.selectedData = option;

    const id = option.iri;
    const label = option.label;
    this.handlerContext.changeControlledValue(this.component, id, label);

    this.setCurrentValue(option);
  }
  inputChanged(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (!val?.trim()) {
      this.clearValue();
    } else {
      if (this.trigger && !this.trigger.panelOpen) {
        this.trigger.openPanel();
      }
      this.loadingOptions = true;
      this.hasSearched = false;
      this.cdr.markForCheck();
    }
  }
  onInputBlur(): void {
    if (this.selectionInProgress) return;
    this.loadingOptions = false;
    this.cdr.markForCheck();

    const raw = this.inputValueControl.getRawValue()?.trim();
    const current = this.getCompoundValue(this.selectedData);
    if (raw && raw !== current) {
      if (this.selectedData) {
        this.inputValueControl.setValue(current, { emitEvent: true });
        this.showRevertHint();
      } else {
        this.clearValue();
        this.showClearedWarning();
      }
      return;
    }
    if (!this.selectedData && raw) {
      this.clearValue();
      this.showClearedWarning();
      return;
    }
    if (this.selectedData !== null) {
      this.setCurrentValue(this.selectedData);
    }
  }
  setCurrentValue(item: OrcidTerm): void {
    const display = this.getCompoundValue(item);
    if (this.inputValueControl.value !== display) {
      this.inputValueControl.setValue(display, { emitEvent: false });
      this.selectedData = item;
    }
    this.getDetails();
  }
  private showRevertHint(): void {
    this.justReverted = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.justReverted = false;
      this.cdr.markForCheck();
    }, 5000);
  }

  private showClearedWarning(): void {
    this.justCleared = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.justCleared = false;
      this.cdr.markForCheck();
    }, 5000);
  }

  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue('', { emitEvent: true });
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  private getDetails(): void {
    if (!this.selectedData || !this.selectedData.iri) {
      console.warn('No valid selected data to retrieve details.');
      return;
    }
    const selectedId = this.selectedData.iri;
    if (this.researcherDetailsCache.has(selectedId)) {
      this.researcherDetails = this.researcherDetailsCache.get(selectedId) ?? null;
      return;
    }
    this.loadingDetails = true;
    this.cdr.markForCheck();
    this.lookup
      .resolve<OrcidResolveResponse>(InputType.orcid, selectedId)
      .pipe(
        finalize(() => {
          this.loadingDetails = false;
          this.cdr.markForCheck();
        }),
        catchError(() => {
          return of(null as never);
        }),
      )
      .subscribe((response: OrcidResolveResponse | null) => {
        if (response && response.found) {
          this.researcherDetails = ResearcherDetails.fromJson(response);
          this.researcherDetailsCache.set(selectedId, this.researcherDetails);
          this.cdr.markForCheck();
        }
      });
  }
  setShowDetails = (setValue: boolean): void => {
    this.showDetails = setValue;
  };
  /**
   * Which authority this is.
   *
   * ORCID keeps its own component because of the researcher panel below — a
   * document with its own shape, cached per term, that no other authority has.
   * The identifier pattern and the message keys come off the shared descriptor
   * even so, because those were the parts that drifted.
   */
  get descriptor() {
    return authorityDescriptorFor(InputType.orcid)!;
  }
}
