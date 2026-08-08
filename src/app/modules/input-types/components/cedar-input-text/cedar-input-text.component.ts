import { Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
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
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ErrorStateMatcher } from '@angular/material/core';
import { InputType } from '../../../shared/models/input-type.model';
import { HtmlDetectService } from '../../../shared/service/html-detect.service';
import { CedarValidators } from '../../../shared/validation/cedar-validators';
import { IriPrefix } from '../../../shared/util/iri-prefix';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, _form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-text',
  templateUrl: './cedar-input-text.component.html',
  styleUrls: ['./cedar-input-text.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputTextComponent extends CedarUIDirective implements OnInit {
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  constraintMinLength: number | null = null;
  constraintMaxLength: number | null = null;
  @Input() handlerContext: HandlerContext;
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
    private iriPrefix: IriPrefix,
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
    this.inputValueControl = new FormControl(null, validators);

    // `typeof`, not a cast: on a literal field the declared default is text, and a
    // template that puts a term node here is declaring something this field cannot
    // hold — which is now skipped rather than assigned as `[object Object]`.
    const declaredDefault = this.component.valueInfo.defaultValue;
    if (typeof declaredDefault === 'string' && this.inputValueControl.getRawValue() == '') {
      this.setValueUIAndModel(declaredDefault);
    }
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
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
      this.checkHTMLContent(this.inputValueControl.value);
    } else {
      this.isRichText = false;
    }
  }
  inputChanged($event: Event): void {
    let val = ($event.target as HTMLTextAreaElement).value;
    if (val.length === 0) {
      val = null;
    }
    this.handlerContext.changeValue(this.component, val);
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
    this.inputValueControl.setValue(currentValue);
  }

  checkOrcid(value: string): boolean {
    const pattern = this.iriPrefix.getOrcidPrefix();
    const orcidReg = new RegExp(`^${pattern}`);
    return orcidReg.test(value);
  }

  checkRor(value: string): boolean {
    const pattern = this.iriPrefix.getRorPrefix();
    const orcidReg = new RegExp(`^${pattern}`);
    return orcidReg.test(value);
  }
  clearValue(): void {
    this.setValueUIAndModel(null);
  }

  private setValueUIAndModel(value: string): void {
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
    window.open(this.originalValue, '_blank');
  }

  protected readonly window = window;
}
