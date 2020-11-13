import {Component, Input, OnInit} from '@angular/core';
import {FieldComponent} from '../../models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ComponentDataService} from '../../service/component-data.service';
import {CedarUIComponent} from '../../models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';
import {HandlerContext} from '../../util/handler-context';
import {Numbers} from '../../models/numbers.model';
import {Xsd} from '../../models/xsd.model';

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
  patternErrorMessage = null;
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
    this.constraintMaxValue = this.component.numberInfo.maxValue;

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }

    const numberType = this.component.numberInfo.numberType;
    const decimalPlace = this.component.numberInfo.decimalPlace;
    let maxDecimalError = '';
    if (numberType === Xsd.int) {
      validators.push(Validators.pattern(Numbers.PATTERN_XSD_INT_AND_LONG));
      this.patternErrorMessage = 'The value should be an integer.';
      if (this.constraintMinValue == null) {
        this.constraintMinValue = Numbers.NUMBER_INT_MIN;
      }
      if (this.constraintMaxValue == null) {
        this.constraintMaxValue = Numbers.NUMBER_INT_MAX;
      }
    }
    if (numberType === Xsd.long) {
      validators.push(Validators.pattern(Numbers.PATTERN_XSD_INT_AND_LONG));
      this.patternErrorMessage = 'The value should be a long integer.';
      if (this.constraintMinValue == null) {
        this.constraintMinValue = Numbers.NUMBER_LONG_MIN;
      }
      if (this.constraintMaxValue == null) {
        this.constraintMaxValue = Numbers.NUMBER_LONG_MAX;
      }
    }
    if (numberType === Xsd.float || numberType === Xsd.double) {
      let pattern: string = Numbers.PATTERN_XSD_FLOAT_AND_DOUBLE;
      let maxDig = '';
      if (decimalPlace != null) {
        maxDig = '' + decimalPlace;
        maxDecimalError = ' Maximum ' + decimalPlace + ' decimals.';
      }
      pattern = pattern.replace(new RegExp('maxDig', 'g'), maxDig);
      validators.push(Validators.pattern(pattern));
    }
    if (numberType === Xsd.float) {
      this.patternErrorMessage = 'The value should be a float.' + maxDecimalError;
    }
    if (numberType === Xsd.double) {
      this.patternErrorMessage = 'The value should be a double.' + maxDecimalError;
    }

    if (this.constraintMinValue != null) {
      validators.push(Validators.min(this.constraintMinValue));
    }
    if (this.constraintMaxValue != null) {
      validators.push(Validators.max(this.constraintMaxValue));
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

    const decimalPlace = this.component.numberInfo.decimalPlace;
    if (decimalPlace != null) {
      s += ' max ' + decimalPlace + ' decimals;';
    }

    return s;
  }
}