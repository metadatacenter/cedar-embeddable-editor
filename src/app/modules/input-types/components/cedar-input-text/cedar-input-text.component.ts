import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ErrorStateMatcher } from '@angular/material/core';
import { InputType } from '../../../shared/models/input-type.model';
import { CedarEmbeddableMetadataEditorComponent } from '../../../shared/components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-text',
  templateUrl: './cedar-input-text.component.html',
  styleUrls: ['./cedar-input-text.component.scss'],
  encapsulation: ViewEncapsulation.None,
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
  ) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }

  ngOnInit(): void {
    super.ngOnInit();
    const validators: any[] = [];
    this.constraintMinLength = this.component.valueInfo.minLength;

    if (this.constraintMinLength != null) {
      validators.push(Validators.minLength(this.constraintMinLength));
    }
    this.constraintMaxLength = this.component.valueInfo.maxLength;

    if (this.constraintMaxLength != null) {
      validators.push(Validators.maxLength(this.constraintMaxLength));
    }

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    this.inputValueControl = new FormControl(null, validators);

    if (this.component.valueInfo.defaultValue != null) {
      if (this.inputValueControl.getRawValue() == '') {
        this.setValueUIAndModel(this.component.valueInfo.defaultValue);
      }
    }
    if (this.readOnlyMode) {
      this.checkHTMLContent();
    }
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  checkHTMLContent() {
    const label = this.cds.getRenderingLabelForComponent(this.component);
    if (label && label.toUpperCase().indexOf('HTML') !== -1) {
      this.isRichText = true;
    }
  }
  protected override onReadOnlyModeChange(mode: boolean): void {
    if (mode) {
      this.checkHTMLContent();
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
    const pattern = CedarEmbeddableMetadataEditorComponent.orcidPrefix;
    const orcidReg = new RegExp(`^${pattern}`);
    return orcidReg.test(value);
  }

  checkRor(value): boolean {
    const pattern = CedarEmbeddableMetadataEditorComponent.rorPrefix;
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
