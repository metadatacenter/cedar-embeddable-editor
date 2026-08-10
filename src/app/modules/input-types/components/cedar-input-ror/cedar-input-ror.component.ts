import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { AuthoritySearchControl } from '../../../shared/util/authority-search-control';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { catchLookupFailure } from '../../../shared/util/lookup-failure';
import { ErrorStateMatcher } from '@angular/material/core';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, tap, finalize, catchError } from 'rxjs/operators';
import { ExternalAuthorityLookupService } from '../../../shared/service/external-authority-lookup.service';
import { authorityDescriptorFor } from '../../../shared/models/authority/authority-descriptor.model';
import { InputType } from '../../../shared/models/input-type.model';
import { MessageHandlerService } from '../../../shared/service/message-handler.service';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { RorTerm } from '../../../shared/models/authority/ror-term.model';
import { RorDetailResponse } from '../../../shared/models/rest/ror-detail/ror-detail-response';
import { isAuthorityTerm } from '../../../shared/models/authority/authority-term.guard';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
@Component({
  selector: 'app-cedar-input-ror',
  templateUrl: './cedar-input-ror.component.html',
  styleUrls: ['./cedar-input-ror.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputRorComponent extends CedarUIDirective implements OnInit, AfterViewInit {
  /**
   * Undefined until the view exists, and for good in read-only mode — the
   * autocomplete input the trigger reads sits behind an `@if` on it. ORCID and
   * ROR already tested for that; the other two reached through it inside a
   * `!readOnlyMode` guard, which is the same fact stated less directly.
   */
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger })
  trigger?: MatAutocompleteTrigger;

  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  selectedData: RorTerm | null = null;
  component!: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl<string | null>(null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  model: RorTerm | null = null;
  rorDetails: RorDetailResponse | null = null;
  showDetails: boolean = false;
  /**
   * An empty list until `ngOnInit` builds the search pipeline, and for good in
   * read-only mode, where there is no autocomplete to feed. A real observable
   * rather than nothing, so the template's async pipe always has one to read.
   */
  filteredOptions: Observable<RorTerm[]> = of([]);
  loadingOptions = false;
  private rorDetailsCache = new Map<string, RorDetailResponse>();
  justReverted = false;
  justCleared = false;
  hasSearched = false;
  /** Whether the last search failed, as opposed to returning nothing. */
  lookupFailed = false;
  selectionInProgress = false;

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private lookup: ExternalAuthorityLookupService,
    private messageHandlerService: MessageHandlerService,
  ) {
    super();
    this.options = fb.group({ inputValue: this.inputValueControl });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    const validators: ValidatorFn[] = [];
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
            this.hasSearched = true;
            // See the ORCID field: `isSame` already required a selection.
            return of(this.selectedData === null ? [] : [this.selectedData]);
          }

          this.loadingOptions = true;
          this.hasSearched = false;
          this.lookupFailed = false;

          return this.filter(val || '').pipe(
            // A failed search and an empty one both used to arrive here as an
            // empty list, and the panel called both "No results found". Recorded
            // so the template can tell the user which of the two happened.
            catchLookupFailure<RorTerm>((error) => {
              this.lookupFailed = true;
              console.error(`CEE ERROR: ROR lookup failed for "${val}"`, error);
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
  ngAfterViewInit(): void {
    if (!this.readOnlyMode) {
      this.trigger?.panelClosingActions.subscribe((event) => {
        // No cast needed: `panelClosingActions` is typed
        // `Observable<MatOptionSelectionChange | null>`, and `source` is on it.
        const selectionMode = !!event && !!event.source;
        if (selectionMode) return;
        if (this.selectedData !== null) {
          this.setCurrentValue(this.selectedData);
        }
      });
    }
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
  onSelectionChange(option: RorTerm): void {
    if (!option) return;
    this.selectionInProgress = false;
    this.selectedData = option;
    const id = option.iri;
    const label = option.label;
    this.handlerContext.changeControlledValue(this.component, id, label);
  }
  setCurrentValue(value: RorTerm): void {
    this.selectedData = value;
    const display = this.getCompoundValue(value);
    this.inputValueControl.setValue(display, { emitEvent: true });
    this.getDetails();
    this.hasSearched = false;
  }
  /**
   * Reconcile the box with the value behind it when the user leaves.
   *
   * ROR already had `clearValue(markError)` and `showRevertHint` — copied from
   * ORCID — but nothing ever called them, because the template never bound a
   * blur event. The machinery was complete and dead, so free text stayed in the
   * field over an instance holding nothing. See `AuthoritySearchControl`.
   */
  onInputBlur(): void {
    if (this.readOnlyMode || this.selectionInProgress) {
      return;
    }
    const outcome = AuthoritySearchControl.reconcileOnBlur(
      this.inputValueControl,
      this.getCompoundValue(this.selectedData),
    );
    if (outcome === 'reverted') {
      this.showRevertHint();
    } else if (outcome === 'cleared') {
      this.selectedData = null;
      this.handlerContext.changeControlledValue(this.component, null, null);
      this.showClearedWarning();
    }
  }

  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue('', { emitEvent: true });
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  setShowDetails = (setValue: boolean): void => {
    this.showDetails = setValue;
  };
  getCompoundValue(option: RorTerm | null): string {
    if (!option) return '';
    const label = option.label ? option.label.trim() : '';
    const id = option.iri ? option.iri.trim() : '';
    return `${label} - ${id}`;
  }
  private filter(val: string): Observable<RorTerm[]> {
    if (this.getCompoundValue(this.selectedData) === val || val === undefined || val === '') {
      return of([]);
    }
    if (this.descriptor.looksLikeIdentifier(val)) {
      // `resolve<RorDetailResponse>`, matching the call in `showDetails` below: both
      // hit the same ROR detail endpoint, and this one hands the result to
      // `RorDetailResponse.fromJSON`, which reads `rawResponse`. Untyped, it resolved
      // to `AuthorityDetailResponse` — the three-field shape that has no `rawResponse`
      // at all. Typing the parser is what surfaced the two calls disagreeing.
      return this.lookup.resolve<RorDetailResponse>(InputType.ror, val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          } else {
            const details = RorDetailResponse.fromJSON(response);
            // Keyed by `response.id`, which is what reads it. It used to be keyed by an
            // IRI read through the model library's key constant — a `RorDetailResponse`
            // has no such property, so every write went in under `undefined` and the
            // lookup below never hit one.
            if (!this.rorDetailsCache.has(response.id)) {
              this.rorDetailsCache.set(response.id, details);
            }
            return [{ iri: response.id, label: response.name, details: details }];
          }
        }),
      );
    } else {
      return this.lookup.search(InputType.ror, val).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          } else if (response.results) {
            return response.results.filter(
              (option: RorTerm) => option.label?.toLowerCase().includes(val.toLowerCase()),
            );
          } else {
            this.messageHandlerService.errorObject(val, response);
            return [];
          }
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
  private getDetails(): void {
    if (!this.selectedData || !this.selectedData.iri) {
      console.warn('No valid selected data to retrieve details.');
      return;
    }
    const selectedId = this.selectedData.iri;
    if (this.rorDetailsCache.has(selectedId)) {
      this.rorDetails = this.rorDetailsCache.get(selectedId) ?? null;
      return;
    }
    this.lookup
      .resolve<RorDetailResponse>(InputType.ror, selectedId)
      .pipe(
        catchError((error) => {
          console.error('Error retrieving details:', error);
          return of(null);
        }),
      )
      .subscribe((response: RorDetailResponse | null) => {
        if (response && response.found) {
          this.rorDetails = RorDetailResponse.fromJSON(response);
          this.rorDetailsCache.set(selectedId, this.rorDetails);
        }
      });
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
  /**
   * Which authority this is.
   *
   * ROR keeps its own component for the organisation panel — geonames,
   * external identifiers, relationships — which is a document unlike any other
   * authority's. The identifier pattern and the message keys come off the shared
   * descriptor, because those are the parts that drifted between the seven.
   */
  get descriptor() {
    return authorityDescriptorFor(InputType.ror)!;
  }
}
