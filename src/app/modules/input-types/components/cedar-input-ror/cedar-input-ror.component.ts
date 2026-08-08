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
import { JsonSchema } from 'cedar-model-typescript-library';
import { ExternalAuthorityLookupService } from '../../../shared/service/external-authority-lookup.service';
import { authorityDescriptorFor } from '../../../shared/models/authority/authority-descriptor.model';
import { InputType } from '../../../shared/models/input-type.model';
import { MessageHandlerService } from '../../../shared/service/message-handler.service';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { RorSearchResponseItem } from '../../../shared/models/rest/ror-search/ror-search-response-item';
import { RorDetailResponse } from '../../../shared/models/rest/ror-detail/ror-detail-response';
import { isInstanceObject } from '../../../shared/models/instance-node.model';

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
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger })
  trigger: MatAutocompleteTrigger;

  @Input() handlerContext: HandlerContext;
  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  selectedData: RorSearchResponseItem | null = null;
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl<string | null>(null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  model: RorSearchResponseItem | null = null;
  rorDetails: RorDetailResponse | null = null;
  showDetails: boolean = false;
  filteredOptions: Observable<RorSearchResponseItem[]>;
  loadingOptions = false;
  private rorDetailsCache = new Map<string, RorDetailResponse>();
  justReverted: boolean;
  hasSearched: boolean;
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
    if (this.component?.valueInfo?.defaultValue) {
      // A default on one of these fields is the term node, not text. Guarded rather
      // than asserted: a template declaring a bare string here would otherwise read
      // as a term with two undefined halves.
      const declared = this.component.valueInfo.defaultValue;
      const defaultTerm = isInstanceObject(declared) ? declared : {};
      const defaultAtId = (defaultTerm[JsonSchema.atId] as string) || null;
      const defaultLabel = (defaultTerm[JsonSchema.rdfsLabel] as string) || null;
      this.updateValue(defaultAtId, defaultLabel);
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
            catchLookupFailure<RorSearchResponseItem>((error) => {
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
      this.trigger.panelClosingActions.subscribe((event) => {
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
  onSelectionChange(option: RorSearchResponseItem): void {
    if (!option) return;
    this.selectionInProgress = false;
    this.selectedData = option;
    const id = option[JsonSchema.atId] as string;
    const rdfsLabel = option[JsonSchema.rdfsLabel] as string;
    this.handlerContext.changeControlledValue(this.component, id, rdfsLabel);
  }
  setCurrentValue(value: RorSearchResponseItem): void {
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
      'invalidRor',
    );
    if (outcome === 'reverted') {
      this.showRevertHint();
    } else if (outcome === 'cleared') {
      this.clearValue(true);
    }
  }

  clearValue(markError: boolean = false): void {
    this.selectedData = null;
    this.inputValueControl.setValue('', { emitEvent: true });
    if (markError) {
      this.inputValueControl.setErrors({ invalidRor: true });
      this.inputValueControl.markAsTouched();
    } else {
      this.inputValueControl.setErrors(null);
    }
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  setShowDetails = (setValue: boolean): void => {
    this.showDetails = setValue;
  };
  getCompoundValue(option: RorSearchResponseItem | null): string {
    if (!option) return '';
    const label = (option[JsonSchema.rdfsLabel] as string) ? (option[JsonSchema.rdfsLabel] as string).trim() : '';
    const id = (option[JsonSchema.atId] as string) ? (option[JsonSchema.atId] as string).trim() : '';
    return `${label} - ${id}`;
  }
  private filter(val: string): Observable<RorSearchResponseItem[]> {
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
            // Keyed by `response.id`, which is what reads it. It used to be keyed by
            // `response[JsonSchema.atId]` — a `RorDetailResponse` has no `@id`, so every
            // write went in under `undefined` and the lookup below never hit one.
            if (!this.rorDetailsCache.has(response.id)) {
              this.rorDetailsCache.set(response.id, details);
            }
            return [{ [JsonSchema.atId]: response.id, [JsonSchema.rdfsLabel]: response.name, details: details }];
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
              (option: RorSearchResponseItem) =>
                (option[JsonSchema.rdfsLabel] as string)?.toLowerCase().includes(val.toLowerCase()),
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
    if (!this.selectedData || !(this.selectedData[JsonSchema.atId] as string)) {
      console.warn('No valid selected data to retrieve details.');
      return;
    }
    const selectedId = this.selectedData[JsonSchema.atId] as string;
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

  protected readonly JsonSchema = JsonSchema;
}
