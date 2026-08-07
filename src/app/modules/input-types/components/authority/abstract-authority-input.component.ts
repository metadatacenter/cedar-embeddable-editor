import { AfterViewInit, Directive, Input, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatLegacyAutocompleteTrigger as MatAutocompleteTrigger } from '@angular/material/legacy-autocomplete';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, map, startWith, switchMap } from 'rxjs/operators';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { HandlerContext } from '../../../shared/util/handler-context';
import { JsonSchema } from 'cedar-model-typescript-library';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ExternalAuthorityLookupService } from '../../../shared/service/external-authority-lookup.service';
import { AuthoritySearchControl } from '../../../shared/util/authority-search-control';
import { AuthorityDescriptor } from '../../../shared/models/authority/authority-descriptor.model';
import { AuthoritySearchResponseItem } from '../../../shared/models/authority/authority-search-response.model';
import { catchLookupFailure } from '../../../shared/util/lookup-failure';

export class AuthorityErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

/**
 * The search-select-resolve flow every external authority field performs.
 *
 * ORCID, ROR, PFAS, PubMed, RRID, NIH Grant and DOI had this seven times over —
 * roughly 1,860 lines of components, produced from one another by name
 * substitution. Diffing the five simplest against each other, the only
 * behavioural difference between any two was the pattern deciding whether typed
 * text is an identifier or a name; the rest was class names and dead
 * commented-out code.
 *
 * The cost of that was not tidiness. The blur handling that discards unusable
 * free text existed in one of the seven, was written but never wired up in a
 * second, and was missing from the other five — so six widgets left text in the
 * box over an instance holding nothing. A validator aimed at the wrong object
 * put an error under all seven on the first keystroke. And the PubMed widget
 * still carries PFAS's identifier pattern, because that line was never changed
 * when the file was copied.
 *
 * A subclass supplies a `descriptor` and nothing else. What it must *not* supply
 * is a second copy of anything below.
 *
 * ORCID and ROR do *not* extend this. Each carries its own copy of the search
 * pipeline alongside the detail panel that is genuinely its own, so a change to
 * the flow here has to be made in those two as well until they are folded in.
 */
@Directive()
export abstract class AbstractAuthorityInputComponent extends CedarUIDirective implements OnInit, AfterViewInit {
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger }) trigger: MatAutocompleteTrigger;
  @Input() handlerContext: HandlerContext;
  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  component: FieldComponent;
  options: FormGroup;
  inputValueControl!: FormControl;
  errorStateMatcher = new AuthorityErrorStateMatcher();
  filteredOptions: Observable<AuthoritySearchResponseItem[]>;
  selectedData: AuthoritySearchResponseItem;
  loadingOptions = false;
  justReverted = false;
  linkIconName = 'open_in_new';

  /**
   * Whether the last search failed rather than returned nothing.
   *
   * Both used to end as an empty option list, so an authority being down was
   * shown to the user as "No results found" — a statement about their query,
   * made when nothing had been learned about their query at all. The distinction
   * only exists if the failure is recorded, so it is recorded here and the
   * template says which of the two happened.
   */
  lookupFailed = false;

  /** Which authority this field searches. The only thing a subclass decides. */
  abstract get descriptor(): AuthorityDescriptor;

  protected constructor(
    protected fb: FormBuilder,
    public cds: ComponentDataService,
    protected activeComponentRegistry: ActiveComponentRegistryService,
    protected lookup: ExternalAuthorityLookupService,
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();

    const validators = [];
    if (this.component?.valueInfo?.requiredValue) {
      validators.push(Validators.required);
    }
    // Deliberately no `CedarValidators.forComponent`. This control holds what
    // the user is typing, and after a selection it holds "Label - https://iri";
    // the IRI itself only ever reaches the model. Validating the control as
    // though it were the field's value rejects every intermediate state, which
    // put "not a valid ... and has been cleared" under the field on the first
    // keystroke. The stored IRI is checked by the data quality report, which
    // sees the value rather than the search text.
    this.inputValueControl = new FormControl(null, validators);
    this.options = this.fb.group({ inputValue: this.inputValueControl });

    this.applyDefaultValue();

    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        startWith(''),
        debounceTime(400),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map((v: any) => (typeof v === 'string' ? v : v?.[JsonSchema.rdfsLabel] ?? '')),
        map((v: string) => v.trim()),
        distinctUntilChanged(),
        switchMap((query: string) => {
          this.lookupFailed = false;
          if (!query) {
            this.loadingOptions = false;
            return of<AuthoritySearchResponseItem[]>([]);
          }
          this.loadingOptions = true;
          return this.filter(query).pipe(
            // The one place a failed lookup is turned back into an empty list,
            // so it is also the one place that can record that it happened.
            // `filter` therefore lets its errors through rather than catching
            // them itself.
            catchLookupFailure<AuthoritySearchResponseItem>((error) => {
              this.lookupFailed = true;
              // Kept alongside the visible notice: the message tells a user the
              // search failed, the console tells a developer how.
              console.error(`CEE ERROR: ${this.descriptor.inputType} lookup failed for "${query}"`, error);
            }),
            finalize(() => {
              this.loadingOptions = false;
            }),
          );
        }),
      );
    }
  }

  ngAfterViewInit(): void {
    if (!this.readOnlyMode) {
      this.trigger.panelClosingActions.subscribe((event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const selectionMode = !!event && !!(event as any).source;
        if (selectionMode) {
          return;
        }
        this.setCurrentValue(this.selectedData);
      });
    }
  }

  /**
   * A template may name a term to start with, as `{@id, rdfs:label}`.
   */
  private applyDefaultValue(): void {
    const defaultValue = this.component?.valueInfo?.defaultValue;
    if (
      defaultValue &&
      typeof defaultValue === 'object' &&
      Object.hasOwn(defaultValue as object, JsonSchema.atId) &&
      Object.hasOwn(defaultValue as object, JsonSchema.rdfsLabel)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const asTerm = defaultValue as any;
      const atId = asTerm[JsonSchema.atId] || null;
      const label = asTerm[JsonSchema.rdfsLabel] || null;
      this.inputValueControl.setValue(label);
      this.handlerContext.changeControlledValue(this.component, atId, label);
    }
  }

  onSelectionChange(option: AuthoritySearchResponseItem): void {
    if (!option) {
      return;
    }
    this.selectedData = option;
    this.handlerContext.changeControlledValue(this.component, option[JsonSchema.atId], option[JsonSchema.rdfsLabel]);
  }

  inputChanged(event: Event): void {
    if (!(event.target as HTMLInputElement).value) {
      this.clearValue();
    } else if (!this.readOnlyMode) {
      // Material 14 checks document.activeElement before opening on input. In
      // Shadow DOM that is the custom-element host, not this input, so open the
      // panel explicitly once Angular has updated matAutocompleteDisabled.
      setTimeout(() => {
        if (!this.trigger.panelOpen) {
          this.trigger.openPanel();
        }
      });
    }
  }

  inputFocused(): void {
    if (this.readOnlyMode) {
      return;
    }
    this.inputValueControl.setValue(this.inputValueControl.value ?? '', { emitEvent: true });
  }

  /**
   * Reconcile the box with the value behind it when the user leaves.
   *
   * Text naming no term cannot be saved, so it must not be left sitting in the
   * field over an instance that holds nothing. See `AuthoritySearchControl` for
   * why the rule lives outside the component.
   */
  onInputBlur(): void {
    if (this.readOnlyMode) {
      return;
    }
    const outcome = AuthoritySearchControl.reconcileOnBlur(
      this.inputValueControl,
      this.getCompoundValue(this.selectedData),
      this.descriptor.errorKey,
    );
    if (outcome === 'reverted') {
      this.showRevertHint();
    } else if (outcome === 'cleared') {
      this.selectedData = null;
      this.handlerContext.changeControlledValue(this.component, null, null);
    }
  }

  setCurrentValue(value: AuthoritySearchResponseItem): void {
    this.selectedData = value;
    this.inputValueControl.setValue(this.getCompoundValue(value), { emitEvent: true });
  }

  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue(null);
    this.inputValueControl.setErrors(null);
    this.handlerContext.changeControlledValue(this.component, null, null);
  }

  /** How a selected term reads in the box: "Label - https://iri". */
  getCompoundValue(option: AuthoritySearchResponseItem): string {
    const label = option?.[JsonSchema.rdfsLabel]?.trim() || '';
    const id = option?.[JsonSchema.atId]?.trim() || '';
    return label || id ? `${label} - ${id}` : '';
  }

  get detailsUrl(): string | null {
    return this.selectedData?.[JsonSchema.atId] || null;
  }

  get isEmpty(): boolean {
    const raw = this.inputValueControl.value;
    const query = (typeof raw === 'string' ? raw : raw?.[JsonSchema.rdfsLabel] ?? '').trim();
    return !query;
  }

  /**
   * Find terms for what the user typed.
   *
   * Two paths, and which one is taken is the only thing that differs between
   * authorities: text that looks like an identifier is resolved directly, and
   * anything else is searched for by name.
   */
  protected filter(query: string): Observable<AuthoritySearchResponseItem[]> {
    if (this.selectedData && this.getCompoundValue(this.selectedData) === query) {
      return of([this.selectedData]);
    }

    if (this.descriptor.looksLikeIdentifier(query)) {
      return this.lookup.resolve(this.descriptor.inputType, query).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          }
          return [
            {
              [JsonSchema.atId]: response.id,
              [JsonSchema.rdfsLabel]: response.name,
              details: response,
            } as AuthoritySearchResponseItem,
          ];
        }),
      );
    }

    return this.lookup.search(this.descriptor.inputType, query).pipe(
      map((response) => {
        const results = response?.results ?? [];
        if (!results.length) {
          return [];
        }
        // The endpoints are inconsistent about honouring `q`, so the widgets all
        // narrowed the results themselves. Kept, because dropping it would widen
        // what a field offers rather than narrow it.
        const needle = (query || '').toLowerCase();
        return needle
          ? results.filter((option) => (option?.[JsonSchema.rdfsLabel] ?? '').toLowerCase().includes(needle))
          : results;
      }),
    );
  }

  /**
   * Show the "edit discarded, previous value restored" hint for a few seconds.
   *
   * ORCID and ROR had this; the other five had the message in their templates
   * with nothing to trigger it.
   */
  protected showRevertHint(): void {
    this.justReverted = true;
    setTimeout(() => {
      this.justReverted = false;
    }, 5000);
  }

  protected readonly JsonSchema = JsonSchema;
}
