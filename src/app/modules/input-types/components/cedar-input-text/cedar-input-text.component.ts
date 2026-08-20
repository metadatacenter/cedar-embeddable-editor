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
  options: FormGroup;
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
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private htmlDetectService: HtmlDetectService,
  ) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
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

  getCharCountHint(): string {
    let len = 0;
    if (this.inputValueControl.value != null) {
      len = this.inputValueControl.value.length;
    }
    let s = '' + len;
    let min = null;
    let max = null;
    if (this.component.valueInfo.minLength != null) {
      min = this.component.valueInfo.minLength;
    }
    if (this.component.valueInfo.maxLength != null) {
      max = this.component.valueInfo.maxLength;
    }
    if (min != null || max != null) {
      s += ' / ';
      if (min != null) {
        s += min + ' ';
      }
      s += ' - ';
      if (max != null) {
        s += max;
      }
    }
    return s;
  }

  goToLink() {
    if (this.originalValue !== null) {
      window.open(this.originalValue, '_blank');
    }
  }

  protected readonly window = window;
}
