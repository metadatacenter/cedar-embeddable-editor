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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormGroupDirective,
  NgForm,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { AuthoritySearchControl } from '../../../shared/util/authority-search-control';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { catchLookupFailure } from '../../../shared/util/lookup-failure';
import { ErrorStateMatcher } from '@angular/material/core';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, startWith, switchMap, tap, finalize } from 'rxjs/operators';
import { AuthorityTerm } from '../../../shared/models/authority/authority-search-response.model';
import { isAuthorityTerm } from '../../../shared/models/authority/authority-term.guard';
import { ControlledFieldDataService } from '../../../shared/service/controlled-field-data.service';
import { MessageHandlerService } from '../../../shared/service/message-handler.service';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { CedarValidators } from '../../../shared/validation/cedar-validators';
import { bioPortalSourceLink, bioPortalTermLink } from '../../../shared/util/bioportal-term-link';
import { SpecTermSource, specTermSourcesOf } from '../../../shared/util/field-spec';
export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, _form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
@Component({
  selector: 'app-cedar-input-controlled',
  templateUrl: './cedar-input-controlled.component.html',
  styleUrls: ['./cedar-input-controlled.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputControlledComponent extends CedarUIDirective implements OnInit, AfterViewInit {
  /**
   * Undefined until the view exists, and for good in read-only mode — the
   * autocomplete input the trigger reads sits behind an `@if` on it. ORCID and
   * ROR already tested for that; the other two reached through it inside a
   * `!readOnlyMode` guard, which is the same fact stated less directly.
   */
  @ViewChild('autoCompleteInput', { static: false, read: MatAutocompleteTrigger }) trigger?: MatAutocompleteTrigger;
  selectedData: AuthorityTerm | null = null;

  /**
   * A press has begun on a suggestion, so the blur it causes is not the user
   * leaving the field. The same name and rule the seven authority widgets carry
   * — added here with the blur handling, because a blur that reconciles without
   * this guard clears the very term being clicked.
   */
  private selectionInProgress = false;

  /** Shown once free text has actually been discarded, not before. */
  justReverted = false;
  justCleared = false;
  component!: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl<string | null>(null, null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  @Input({ required: true }) handlerContext!: HandlerContext;
  model: AuthorityTerm | null = null;
  /**
   * An empty list until `ngOnInit` builds the search pipeline, and for good in
   * read-only mode, where there is no autocomplete to feed. A real observable
   * rather than nothing, so the template's async pipe always has one to read.
   */
  filteredOptions: Observable<AuthorityTerm[]> = of([]);
  loading = false;
  /** Whether the last lookup failed, as opposed to matching nothing. */
  lookupFailed = false;

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private controlledFieldDataService: ControlledFieldDataService,
    private messageHandlerService: MessageHandlerService,
  ) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }
  override ngOnInit(): void {
    super.ngOnInit();
    const validators: ValidatorFn[] = [];

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    validators.push(CedarValidators.forComponent(this.component));
    this.inputValueControl = new FormControl<string | null>(null, validators);

    if (!this.readOnlyMode) {
      this.filteredOptions = this.inputValueControl.valueChanges.pipe(
        startWith(''),
        debounceTime(400),
        distinctUntilChanged(),
        tap(() => (this.loading = true)),
        switchMap((val) => {
          this.lookupFailed = false;
          return this.filter(val || '').pipe(
            /**
             * Without this, a failing terminology server did not merely go
             * unreported: the error reached `valueChanges`, which ends the
             * observable, so the field's autocomplete stopped working for the
             * rest of the session and only a reload brought it back. Catching
             * here keeps the stream alive and records what happened.
             */
            catchLookupFailure<AuthorityTerm>((error) => {
              this.lookupFailed = true;
              this.messageHandlerService.errorObject(`terminology lookup failed for "${val}"`, error as object);
            }),
            finalize(() => (this.loading = false)),
          );
        }),
      );
    }
  }
  ngAfterViewInit(): void {
    if (!this.readOnlyMode) {
      this.trigger?.panelClosingActions.subscribe(() => {
        if (this.selectedData !== null) {
          this.setCurrentValue(this.selectedData);
        }
      });
    }
  }
  /**
   * The offered terms, narrowed to those whose label matches what was typed.
   *
   * The endpoint is inconsistent about honouring the query, so the widget
   * narrows the results itself — the same rule the seven authority widgets
   * apply. A term with no label is dropped rather than shown blank.
   */
  filter(val: string): Observable<AuthorityTerm[]> {
    return this.controlledFieldDataService
      .getData(val, this.component)
      .pipe(map((terms) => terms.filter((term) => term.label.toLowerCase().includes(val.toLowerCase()))));
  }

  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  /** The hint stands for a few seconds, matching the authority widgets. */
  private showRevertHint(): void {
    this.justReverted = true;
    setTimeout(() => {
      this.justReverted = false;
    }, 5000);
  }

  /** Bound to the option's `mousedown`, which precedes the blur it causes. */
  selectionStarting(): void {
    this.selectionInProgress = true;
  }

  onSelectionChange(option: AuthorityTerm): void {
    this.selectionInProgress = false;
    // `|| null` because a term arriving without a label is a state this component
    // already handles — `filter` drops such items from the list — and null is what
    // the model holds for a term whose label is unknown, rather than an empty string.
    this.handlerContext.changeControlledValue(this.component, option.iri, option.label || null);
    if (option) {
      this.selectedData = option;
    }
  }
  inputChanged(event: Event): void {
    if (!(event.target as HTMLTextAreaElement).value) {
      this.clearValue();
    }
  }

  /**
   * Reconcile the box with the term behind it when the user leaves.
   *
   * This widget had no blur handling at all, so text naming no term simply
   * stayed in the field over an instance holding nothing — the field looked
   * filled and read back blank. That is the defect the seven external-authority
   * widgets were fixed for; this one searches BioPortal rather than an
   * authority, and was never part of that pass.
   *
   * The rule itself is `AuthoritySearchControl.reconcileOnBlur`, unchanged and
   * shared, so the two families cannot drift apart on what a blur means.
   */
  onInputBlur(): void {
    if (this.readOnlyMode || this.selectionInProgress) {
      return;
    }
    const outcome = AuthoritySearchControl.reconcileOnBlur(this.inputValueControl, this.selectedData?.label ?? null);
    if (outcome === 'reverted') {
      this.showRevertHint();
    } else if (outcome === 'cleared') {
      this.selectedData = null;
      this.handlerContext.changeControlledValue(this.component, null, null);
      this.showClearedWarning();
    }
  }

  /** Explain a discarded value without leaving an already-cleared field invalid. */
  private showClearedWarning(): void {
    this.justCleared = true;
    setTimeout(() => {
      this.justCleared = false;
    }, 5000);
  }
  // inputFocused(): void {
  //   if (!this.readOnlyMode) {
  //     const currentValue = this.inputValueControl.value || '';
  //     this.filteredOptions = this.filter(currentValue);
  //     setTimeout(() => this.trigger.openPanel(), 0);
  //   }
  // }
  setCurrentValue(currentValue: unknown): void {
    // Remember the term itself, not only its rendering. It is what the BioPortal
    // link is built from, and read-write selection records it the same way.
    const term = isAuthorityTerm(currentValue) ? currentValue : null;
    this.selectedData = term;
    if (this.readOnlyMode) {
      const displayTerm = this.getBioPortalTermDisplayValue(currentValue);
      this.inputValueControl.setValue(displayTerm);
    } else {
      this.inputValueControl.setValue(term?.label ?? (typeof currentValue === 'string' ? currentValue : null));
    }
  }
  /*
   * `unknown`, matching what `setCurrentValue` is handed. A controlled value arrives
   * as a term; anything else — a plain string on a field whose constraint was
   * removed — falls through the last branch and is shown as-is.
   */
  /**
   * How a selected term reads in the box: "Label - https://iri".
   *
   * No parentheses around the IRI. This wrapped it — `label - (iri)` — where the
   * seven external-authority fields render `label - iri`, and they are the same
   * kind of value shown in the same kind of box, one row apart. `getCompoundValue`
   * in `abstract-authority-input.component.ts` is the form they use.
   */
  /**
   * The authorities this field draws on, for the box to state when it holds no value.
   *
   * Rendered as links, so the box showing them cannot be an `input`: placeholder text is not
   * clickable. It is a bordered element instead, the way the read-only clock already is — and it
   * appears only while the field is empty and unreadable-into, so none of what the note at the top of
   * this template warns about applies. There is no Clear action to lose, no button inside an anchor,
   * and the value's own suffix link is untouched.
   */
  get specSources(): ReadonlyArray<SpecTermSource> {
    return specTermSourcesOf(this.component);
  }

  /** Where an authority can be read about, or null when it names no acronym to address it by. */
  specSourceLink(source: SpecTermSource): string | null {
    return bioPortalSourceLink(source);
  }

  getBioPortalTermDisplayValue(value: unknown): string {
    const term = isAuthorityTerm(value) ? value : { iri: '', label: '' };
    if (term.label && term.iri) {
      return `${term.label} - ${term.iri}`;
    } else return value as string;
  }

  /**
   * The BioPortal page for the term the field holds, or null when it holds none.
   *
   * Derived rather than assigned. It used to be set as a side effect of the
   * function that formats the display text, and that function only runs in
   * read-only mode — so the link existed in one mode and not the other for no
   * reason anyone chose. The constraint the term came through decides which
   * Built from the constraint's acronym, in `bioPortalTermLink`.
   */
  /**
   * Whether to render the term as a value rather than as a control. Same rule as the authority
   * fields: read-only with a term in hand, the identifier belongs in a link, and text inside an
   * `input` cannot be one.
   */
  get showsTermAsValue(): boolean {
    return this.readOnlyMode && this.selectedData !== null;
  }

  get bioPortalTermLink(): string | null {
    return bioPortalTermLink(this.component.controlledInfo, this.selectedData?.iri);
  }
  clearValue(): void {
    this.selectedData = null;
    this.inputValueControl.setValue(null);
    this.handlerContext.changeControlledValue(this.component, null, null);
  }
  private setValueUIAndModel(iri: string, label: string): void {
    this.inputValueControl.setValue(label);
    this.handlerContext.changeControlledValue(this.component, iri, label);
  }
}
