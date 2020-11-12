import {Component, Input, OnInit} from '@angular/core';
import {FieldComponent} from '../../models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ComponentDataService} from '../../service/component-data.service';
import {CedarUIComponent} from '../../models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';
import {HandlerContext} from '../../util/handler-context';

@Component({
  selector: 'app-cedar-input-numeric',
  templateUrl: './cedar-input-numeric.component.html',
  styleUrls: ['./cedar-input-numeric.component.scss']
})
export class CedarInputNumericComponent extends CedarUIComponent implements OnInit {

  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, Validators.min(10));
  activeComponentRegistry: ActiveComponentRegistryService;
  unitOfMeasure: string = null;
  constraintMinValue = null;
  constraintMaxValue = null;
  @Input() handlerContext: HandlerContext;

  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {
    this.unitOfMeasure = this.component.numberInfo.unitOfMeasure;

    const validators: any[] = [];

    this.constraintMinValue = this.component.numberInfo.minValue;
    if (this.constraintMinValue != null) {
      validators.push(Validators.min(this.constraintMinValue));
    }
    this.constraintMaxValue = this.component.numberInfo.maxValue;
    if (this.constraintMaxValue != null) {
      validators.push(Validators.max(this.constraintMaxValue));
    }
    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    this.inputValueControl = new FormControl(null, validators);
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged($event: Event): void {
    this.handlerContext.changeValue(this.component, ($event.target as HTMLTextAreaElement).value);
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

  getMinMaxValueHint(): string {
    let s = '';
    let min = null;
    let max = null;
    if (this.component.numberInfo.minValue != null) {
      min = this.component.numberInfo.minValue;
    }
    if (this.component.numberInfo.maxValue != null) {
      max = this.component.numberInfo.maxValue;
    }
    if (min != null || max != null) {
      if (min != null) {
        s += 'min: ' + min + '; ';
      }
      if (max != null) {
        s += 'max: ' + max + ';';
      }
    }
    return s;
  }
}
