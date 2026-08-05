import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
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
})
export class CedarInputTextComponent extends CedarUIDirective implements OnInit {
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  constraintMinLength = null;
  constraintMaxLength = null;
  @Input() handlerContext: HandlerContext;
  inputText = InputType.text;
  inputTextarea = InputType.textarea;
  isRichText: boolean = false;
  isOrcid: boolean = false;
  isRor: boolean = false;
  originalValue = null;

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

  ngOnInit(): void {
    super.ngOnInit();
    const validators: ValidatorFn[] = [];
    this.constraintMinLength = this.component.valueInfo.minLength;

    this.constraintMaxLength = this.component.valueInfo.maxLength;

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    validators.push(CedarValidators.forComponent(this.component));
    this.inputValueControl = new FormControl(null, validators);

    if (this.component.valueInfo.defaultValue != null) {
      if (this.inputValueControl.getRawValue() == '') {
        this.setValueUIAndModel(this.component.valueInfo.defaultValue);
      }
    }
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  checkHTMLContent(value) {
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

  setCurrentValue(currentValue: any): void {
    if (this.readOnlyMode) {
      this.checkHTMLContent(currentValue);
      if (this.checkOrcid(currentValue)) {
        this.isOrcid = true;
        this.originalValue = currentValue as string;
        currentValue = currentValue.split('/').pop();
      } else if (this.checkRor(currentValue)) {
        this.isRor = true;
        this.originalValue = currentValue as string;
        currentValue = currentValue.split('/').pop();
      }
    }
    this.inputValueControl.setValue(currentValue);
  }

  checkOrcid(value): boolean {
    const pattern = this.iriPrefix.getOrcidPrefix();
    const orcidReg = new RegExp(`^${pattern}`);
    return orcidReg.test(value);
  }

  checkRor(value): boolean {
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
