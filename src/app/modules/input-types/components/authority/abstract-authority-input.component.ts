import { AfterViewInit, Directive, Input, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ErrorStateMatcher, MatOptionSelectionChange } from '@angular/material/core';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable, of, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, map, startWith, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { HandlerContext } from '../../../shared/util/handler-context';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ExternalAuthorityLookupService } from '../../../shared/service/external-authority-lookup.service';
import { AuthoritySearchControl } from '../../../shared/util/authority-search-control';
import { AuthorityDescriptor } from '../../../shared/models/authority/authority-descriptor.model';
import { AuthorityTerm } from '../../../shared/models/authority/authority-search-response.model';
import { InputType } from '../../../shared/models/input-type.model';
import { narrowByQuery } from '../../../shared/util/authority-narrowing';
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
 * All seven authority widgets extend this class. ORCID and ROR add their own
 * detail panels, but the search and lifecycle rules still live here once.
 */
@Directive()
export abstract class AbstractAuthorityInputComponent extends CedarUIDirective implements OnInit, AfterViewInit {
  /**
   * Undefined until the view exists, and for good in read-only mode — the
   * autocomplete input the trigger reads sits behind an `@if` on it. ORCID and
   * ROR already tested for that; the other two reached through it inside a
   * `!readOnlyMode` guard, which is the same fact stated less directly.
   */
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger }) trigger?: MatAutocompleteTrigger;
  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  component!: FieldComponent;
  /*
   * Both built in `ngOnInit`, because the control's validators come off the
   * component and that arrives as an input. Asserted rather than made optional:
   * Angular runs `ngOnInit` before it first checks the template that binds them,
   * so there is no render in which they are absent.
   */
  options!: FormGroup;
  inputValueControl!: FormControl<string | null>;
  errorStateMatcher = new AuthorityErrorStateMatcher();
  /**
   * An empty list until `ngOnInit` builds the search pipeline, and for good in
   * read-only mode, where there is no autocomplete to feed. A real observable
   * rather than nothing, so the template's async pipe always has one to read.
   */
  filteredOptions: Observable<AuthorityTerm[]> = of([]);
  selectedData: AuthorityTerm | null = null;

  /**
   * A press has begun on a suggestion, so the blur it causes is not the user
   * leaving the field.
   *
   * The same name and the same rule ORCID and ROR already carry. Those two do
   * not extend this class, they had the guard, and the five widgets folded in
   * here did not — the identical shape of omission the header describes for the
   * blur handling itself, found the same way.
   */
  private selectionInProgress = false;
  loadingOptions = false;
  justReverted = false;
  justCleared = false;
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

  /** PubMed's human label is an article title; keep it from turning one selected value into a card. */
  get truncatesSelectedLabel(): boolean {
    return this.descriptor.inputType === InputType.pmid;
  }

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
    this.inputValueControl = new FormControl<string | null>(null, validators);
    this.options = this.fb.group({ inputValue: this.inputValueControl });

    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        startWith(''),
        debounceTime(400),
        // The control holds text, never a term: every `mat-option` in the three
        // templates that drive this binds `[value]` to a compound string. The
        // read this replaces also handled an option object, which is what the
        // seven services it came from did before that was true.
        map((v: string | null) => v ?? ''),
        map((v: string) => v.trim()),
        distinctUntilChanged(),
        switchMap((query: string) => {
          this.lookupFailed = false;
          if (!query) {
            this.loadingOptions = false;
            return of<AuthorityTerm[]>([]);
          }
          this.loadingOptions = true;
          return this.filter(query).pipe(
            // The one place a failed lookup is turned back into an empty list,
            // so it is also the one place that can record that it happened.
            // `filter` therefore lets its errors through rather than catching
            // them itself.
            catchLookupFailure<AuthorityTerm>((error) => {
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
        takeUntilDestroyed(this.destroyRef),
      );
    }
  }

  ngAfterViewInit(): void {
    if (!this.readOnlyMode) {
      this.trigger?.panelClosingActions.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        // `panelClosingActions` emits the option-selection event that closed the
        // panel, or null when something else did. `source` is the option.
        const selectionMode = !!event?.source;
        const selectionWasInProgress = this.selectionInProgress;
        // A press that closed the panel without choosing anything — dragged off
        // the option, or a click outside — leaves the flag set otherwise, and
        // the next blur would find it and decline to reconcile forever.
        this.selectionInProgress = false;
        if (selectionMode) {
          return;
        }
        if (this.selectedData !== null) {
          this.setCurrentValue(this.selectedData);
        } else if (selectionWasInProgress) {
          // The blur caused by the press was deliberately ignored. With no
          // prior selection to restore, finish that deferred reconciliation now
          // or the unstored query remains visible after the user has left.
          this.reconcileWithSelection();
        }
      });
    }
  }

  /**
   * A press has landed on a suggestion.
   *
   * Bound to `mousedown`, which fires before the blur it causes — so by the time
   * `onInputBlur` runs, this has already said the blur is not the user leaving.
   */
  selectionStarting(): void {
    this.selectionInProgress = true;
  }

  /**
   * A suggestion the user chose.
   *
   * Material reports through this same output the option it *deselects* when a
   * new one is chosen, and that report arrives after the choice — so a handler
   * reading only the option it was bound to recorded the old term over the new
   * one whenever the panel still listed both. `isUserInput` is what tells a
   * choice from its echo, and is the only thing about the event this needs.
   */
  onSelectionChange(option: AuthorityTerm, { isUserInput }: Pick<MatOptionSelectionChange, 'isUserInput'>): void {
    if (!option || !isUserInput) {
      return;
    }
    this.selectionInProgress = false;
    this.selectedData = option;
    this.handlerContext.changeControlledValue(this.component, option.iri || null, option.label || null);
  }

  inputChanged(event: Event): void {
    if (!(event.target as HTMLInputElement).value) {
      this.clearValue();
    } else if (!this.readOnlyMode) {
      // Material 14 checks document.activeElement before opening on input. In
      // Shadow DOM that is the custom-element host, not this input, so open the
      // panel explicitly once Angular has updated matAutocompleteDisabled.
      timer(1)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.trigger && !this.trigger.panelOpen) {
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
    /*
     * Clicking a suggestion blurs the input, and the blur arrives *before*
     * Material reports the selection. Reconciling here would then read
     * `selectedData` as still null, decide the typed text names no term, and
     * clear the very value being chosen — emptying the box and pushing null to
     * the host. Measured at 7 failures in 24 clicks before this guard, and it is
     * what the browser suite's one intermittent check had been reporting all
     * along.
     *
     * The question is which gesture caused the blur, so the guard asks exactly
     * that: a press on a suggestion sets `selectionInProgress` before the blur can
     * fire, and `onSelectionChange` is then entitled to the decision instead.
     *
     * Deliberately not "is the panel open?" — that was the first attempt and it
     * is wrong twice over. The panel being open says nothing about whether a
     * selection is coming, and a blur that leaves the field does not reliably
     * close it: the browser suite's free-text checks call `blur()` with the
     * panel still open, so deferring to `panelClosingActions` waited for an
     * event that never arrived and left the rejected text sitting in the box.
     */
    if (this.selectionInProgress) {
      return;
    }
    this.reconcileWithSelection();
  }

  /** What blur decides once nothing is in flight. */
  private reconcileWithSelection(): void {
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

  setCurrentValue(value: AuthorityTerm): void {
    this.selectedData = value;
    this.inputValueControl.setValue(this.getCompoundValue(value), { emitEvent: true });
  }

  /**
   * Empty the box and the value behind it.
   *
   * Nothing here clears the control's errors. It did, from the days when
   * `CedarValidators.forComponent` sat on this control and put a pattern error
   * under every keystroke; with that gone, the only validator left is
   * `required`, and wiping it left a required field emptied by backspacing
   * reporting itself satisfied over nothing — and the notice under it unlit.
   */
  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue(null);
    this.handlerContext.changeControlledValue(this.component, null, null);
  }

  /** How a selected term reads in the box: "Label - https://iri". */
  getCompoundValue(option: AuthorityTerm | null): string {
    const label = option?.label?.trim() || '';
    const id = option?.iri?.trim() || '';
    return label || id ? `${label} - ${id}` : '';
  }

  get detailsUrl(): string | null {
    return this.selectedData?.iri || null;
  }

  /**
   * Whether to render the term as a value rather than as a control.
   *
   * Read-only with a term in hand: there is nothing to type into, and the identifier should be a
   * link, which text inside an `input` cannot be. Read-only with nothing in hand keeps the control,
   * whose placeholder states the specification — and with no instance behind the form the renderer
   * has already replaced the whole field with its specification box.
   */
  get showsTermAsValue(): boolean {
    return this.readOnlyMode && this.selectedData !== null;
  }

  get isEmpty(): boolean {
    return !(this.inputValueControl.value ?? '').trim();
  }

  /**
   * Whether the box is showing exactly the term behind it, unedited.
   *
   * There is nothing to suggest in that state — the one candidate is already in the
   * field — so the panel does not open and no lookup is made. It becomes false on the
   * first keystroke, which is when suggestions become useful again.
   */
  get showsSelectedTerm(): boolean {
    return !!this.selectedData && this.getCompoundValue(this.selectedData) === this.inputValueControl.value;
  }

  /**
   * Find terms for what the user typed.
   *
   * Two paths, and which one is taken is the only thing that differs between
   * authorities: text that looks like an identifier is resolved directly, and
   * anything else is searched for by name.
   */
  protected filter(query: string): Observable<AuthorityTerm[]> {
    /*
     * Nothing to offer when the box already holds the term it would offer.
     *
     * `inputFocused` re-emits the current value to reopen the panel, so focusing a
     * populated field arrives here with the compound `Label - iri` as the query.
     * Returning `[this.selectedData]` for that answered it with the value itself:
     * clicking a filled field produced a one-item list mirroring what was already in
     * the box, on all seven authorities.
     *
     * `of([])` is what the two hand-written widgets did before they moved onto this
     * base — ROR's filter opened with the same comparison and returned nothing — so
     * this restores their behaviour rather than inventing one. An empty list means
     * Material shows no panel at all, which is the right answer to "what else could
     * this be?" when the answer is nothing.
     */
    if (this.showsSelectedTerm && query === this.inputValueControl.value) {
      return of([]);
    }

    if (this.descriptor.looksLikeIdentifier(query)) {
      return this.lookup.resolve(this.descriptor.inputType, query).pipe(
        map((response) => {
          if (!response || response.found === false) {
            return [];
          }
          // The resolved record itself is not carried on the term. It was, as
          // `details`, and nothing on this path ever read it — the two widgets
          // that show a record fetch it themselves into their own typed field.
          return [{ iri: response.id, label: response.name }];
        }),
      );
    }

    return this.lookup.search(this.descriptor.inputType, query).pipe(
      map((response) => {
        const results = response?.results ?? [];
        if (!results.length) {
          return [];
        }
        // The endpoints are inconsistent about honouring `q`, so the results are
        // narrowed here too. See `narrowByQuery` for why it matches every word
        // rather than the query as one substring.
        return narrowByQuery(results, query);
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
    timer(5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => (this.justReverted = false));
  }

  /** The text was discarded, but the now-empty optional field is not invalid. */
  private showClearedWarning(): void {
    this.justCleared = true;
    timer(5000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => (this.justCleared = false));
  }
}
