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

  checkHTMLContent(value: string): void {
    if (this.htmlDetectService.isHtmlString(value)) {
      this.isRichText = true;
    }
  }
  protected override onReadOnlyModeChange(mode: boolean): void {
    if (mode) {
      this.checkHTMLContent(this.inputValueControl.value ?? '');
    } else {
      this.isRichText = false;
    }
  }
  inputChanged($event: Event): void {
    // An emptied box clears the field rather than storing '', which is what the
    // instance means by an unfilled slot.
    const typed = ($event.target as HTMLTextAreaElement).value;
    this.handlerContext.changeValue(this.component, typed.length === 0 ? null : typed);
  }

  setCurrentValue(currentValue: unknown): void {
    // Narrowed once, at the top. Everything in here reads the value as text — the
    // HTML sniff and both IRI patterns — so proving it is a string here replaces the
    // two `as string` casts that used to state the same fact twice.
    if (this.readOnlyMode && typeof currentValue === 'string') {
      this.checkHTMLContent(currentValue);
      if (this.checkOrcid(currentValue)) {
        this.isOrcid = true;
        this.originalValue = currentValue;
        currentValue = currentValue.split('/').pop();
      } else if (this.checkRor(currentValue)) {
        this.isRor = true;
        this.originalValue = currentValue;
        currentValue = currentValue.split('/').pop();
      }
    }
    this.inputValueControl.setValue(typeof currentValue === 'string' ? currentValue : null);
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
