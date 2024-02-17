import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { CedarUIComponent } from '../../../shared/models/ui/cedar-ui-component.model';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ComponentDataService } from '../../../shared/service/component-data.service';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-link',
  templateUrl: './cedar-input-link.component.html',
  styleUrls: ['./cedar-input-link.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarInputLinkComponent extends CedarUIComponent implements OnInit {
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  @Input() handlerContext: HandlerContext;
  readOnlyMode;

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
    const validators: any[] = [];

    const reg = /(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})[/\w .-]*\/?/i;
    validators.push(Validators.pattern(reg));

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }

    if (this.handlerContext && this.handlerContext.readOnlyMode) {
      this.readOnlyMode = this.handlerContext.readOnlyMode;
    }

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

  inputChanged($event: Event): void {
    let val = ($event.target as HTMLTextAreaElement).value;

    if (val.length === 0) {
      val = null;
    }
    this.handlerContext.changeValue(this.component, val);
  }

  setCurrentValue(currentValue: any): void {
    this.inputValueControl.setValue(currentValue);
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
    return '' + len;
  }
}
