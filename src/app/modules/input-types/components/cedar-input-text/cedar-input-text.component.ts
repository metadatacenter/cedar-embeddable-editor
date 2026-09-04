import { Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { InputType } from '../../../shared/models/input-type.model';
import { HtmlDetectService } from '../../../shared/service/html-detect.service';
import { CedarValidators } from '../../../shared/validation/cedar-validators';

/** Where an ORCID iD lives, which is not a deployment's choice. */
const ORCID_IRI_PREFIX = 'https://orcid.org/';
/** Where a ROR identifier lives, likewise. */
const ROR_IRI_PREFIX = 'https://ror.org/';

@Component({
  selector: 'app-cedar-input-text',
  templateUrl: './cedar-input-text.component.html',
  styleUrls: ['./cedar-input-text.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputTextComponent extends CedarUIDirective implements OnInit {
  component!: FieldComponent;
  /*
   * Both built in `ngOnInit`, because the control's validators come off the
   * component and that arrives as an input. Asserted rather than made optional:
   * Angular runs `ngOnInit` before it first checks the template that binds them,
   * so there is no render in which they are absent. The same shape
   * `AbstractAuthorityInputComponent` already uses.
   */
  options!: FormGroup;
  inputValueControl = new FormControl<string | null>(null, null);
  constraintMinLength: number | null = null;
  constraintMaxLength: number | null = null;
  @Input({ required: true }) handlerContext!: HandlerContext;
  inputText = InputType.text;
  inputTextarea = InputType.textarea;
  isRichText: boolean = false;
  isOrcid: boolean = false;
  isRor: boolean = false;
  originalValue: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private htmlDetectService: HtmlDetectService,
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    const validators: ValidatorFn[] = [];
    this.constraintMinLength = this.component.valueInfo.minLength;

    this.constraintMaxLength = this.component.valueInfo.maxLength;

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    validators.push(CedarValidators.forComponent(this.component));
    this.inputValueControl = new FormControl<string | null>(null, validators);
    // Beside the control it holds. Built in the constructor, the group kept the
    // control this line replaces — see `input-control-binding.spec.ts`.
    this.options = this.fb.group({ inputValue: this.inputValueControl });
  }

  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  /**
   * Re-derive the presentation from the value in hand.
   *
   * A persistent identifier's link and rich text's markup are read-only
   * presentations; editable, the box is an input over the stored value whatever
   * it holds. Only the rich-text flag used to be lowered here, so a form
   * switched from reading to editing kept the ORCID link where the input should
   * be, and the field could not be edited. `originalValue` is the whole
   * identifier, of which the box shows only the last segment.
   *
   * The view is marked afterwards, through the base class. Which of the three
   * renderings this template draws is decided here and nowhere a template event
   * could mark it, and while the link is drawn there is no form field beneath it
   * whose control could mark the view either — so without this the switch to
   * editable left the link standing until something else happened to redraw.
   */
  protected override onReadOnlyModeChange(mode: boolean): void {
    this.setCurrentValue(this.originalValue ?? this.inputValueControl.value);
    super.onReadOnlyModeChange(mode);
  }
  inputChanged($event: Event): void {
    // An emptied box clears the field rather than storing '', which is what the
    // instance means by an unfilled slot.
    const typed = ($event.target as HTMLTextAreaElement).value;
    this.handlerContext.changeValue(this.component, typed.length === 0 ? null : typed);
  }

  setCurrentValue(currentValue: unknown): void {
    const text = typeof currentValue === 'string' ? currentValue : null;
    // Every flag is decided for this value, not merely raised by it. They were
    // set and never cleared, so the one widget a repeating field reuses, paging
    // from an occurrence holding an ORCID to one holding plain text, went on
    // rendering the text as a link — to the previous occurrence's ORCID. The
    // presentations exist only while reading; editable, the box holds the text.
    const presented = this.readOnlyMode ? text : null;
    this.isOrcid = presented !== null && this.checkOrcid(presented);
    this.isRor = presented !== null && this.checkRor(presented);
    this.isRichText = presented !== null && this.htmlDetectService.isHtmlString(presented);
    this.originalValue = this.isOrcid || this.isRor ? presented : null;
    // An identifier is shown by its last segment; the link keeps the whole IRI.
    this.inputValueControl.setValue(this.originalValue === null ? text : this.originalValue.split('/').pop() ?? null);
  }

  /**
   * Whether a read-only text field is holding a persistent identifier.
   *
   * Fixed strings, and a `startsWith` rather than a regex. These were two host
   * configuration keys, `orcidPrefix` and `rorPrefix`, interpolated straight into
   * `new RegExp('^' + prefix)` — so every `.` in the configured URL matched any
   * character, and a prefix carrying a regex metacharacter matched something else
   * again or threw. They were also prefixes in name only: nothing here mints or
   * builds a URL, it recognises one. And they existed for two of the seven
   * authorities CEE knows, so the same value in a DOI or RRID field got none of
   * this.
   *
   * A registry's own IRI is not a deployment's to configure — orcid.org is
   * orcid.org wherever CEE is embedded — so what is left is a constant.
   */
  checkOrcid(value: string): boolean {
    return value.startsWith(ORCID_IRI_PREFIX);
  }

  checkRor(value: string): boolean {
    return value.startsWith(ROR_IRI_PREFIX);
  }
  clearValue(): void {
    this.setValueUIAndModel(null);
  }

  private setValueUIAndModel(value: string | null): void {
    this.inputValueControl.setValue(value);
    this.handlerContext.changeValue(this.component, value);
  }

  /**
   * The counter under a text field: how much has been typed, against what the template
   * allows.
   *
   * Assembled from the bounds a field actually states. It used to append a dash whether
   * or not a bound stood on either side of it, so a field with a maximum and no minimum
   * — the common case — read `0 /  - 15`. A range takes the ` .. ` a repeating
   * component's occurrence range already uses, with `∞` for an unbounded maximum.
   */
  getCharCountHint(): string {
    const length = this.inputValueControl.value?.length ?? 0;
    const { minLength, maxLength } = this.component.valueInfo;
    if (minLength != null && maxLength != null) {
      return `${length} / ${minLength} .. ${maxLength}`;
    }
    if (maxLength != null) {
      return `${length} / ${maxLength}`;
    }
    if (minLength != null) {
      return `${length} / ${minLength} .. ∞`;
    }
    return `${length}`;
  }

  goToLink() {
    if (this.originalValue !== null) {
      window.open(this.originalValue, '_blank');
    }
  }

  protected readonly window = window;
}
