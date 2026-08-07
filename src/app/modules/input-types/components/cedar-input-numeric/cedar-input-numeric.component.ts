import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { Numbers } from '../../../shared/models/numbers.model';
import { Xsd } from '../../../shared/models/xsd.model';
import { CedarValidators } from '../../../shared/validation/cedar-validators';

@Component({
  selector: 'app-cedar-input-numeric',
  templateUrl: './cedar-input-numeric.component.html',
  styleUrls: ['./cedar-input-numeric.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  standalone: false,
})
export class CedarInputNumericComponent extends CedarUIDirective implements OnInit {
  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, Validators.min(10));
  unitOfMeasure: string = null;
  constraintMinValue = null;
  constraintMaxValue = null;
  patternErrorMessage = null;
  @Input() handlerContext: HandlerContext;

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

  override ngOnInit(): void {
    super.ngOnInit();
    this.unitOfMeasure = this.component.numberInfo.unitOfMeasure;

    const validators: ValidatorFn[] = [];

    this.constraintMinValue = this.component.numberInfo.minValue;
    this.constraintMaxValue = this.component.numberInfo.maxValue;

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }

    // Type patterns, the type's own range, min/max and decimalPlace all come
    // from FieldValueValidator now, so the widget and the data quality report
    // cannot disagree about what a valid number is. The displayed bounds below
    // are still resolved here because the template shows them as hints.
    const numberType = this.component.numberInfo.numberType;
    if (this.constraintMinValue == null || this.constraintMaxValue == null) {
      const implicitBounds = {
        [Xsd.int]: [Numbers.NUMBER_INT_MIN, Numbers.NUMBER_INT_MAX],
        [Xsd.long]: [Numbers.NUMBER_LONG_MIN, Numbers.NUMBER_LONG_MAX],
        [Xsd.byte]: [Numbers.NUMBER_BYTE_MIN, Numbers.NUMBER_BYTE_MAX],
        [Xsd.short]: [Numbers.NUMBER_SHORT_MIN, Numbers.NUMBER_SHORT_MAX],
      }[numberType];
      if (implicitBounds) {
        this.constraintMinValue = this.constraintMinValue ?? implicitBounds[0];
        this.constraintMaxValue = this.constraintMaxValue ?? implicitBounds[1];
      }
    }
    this.patternErrorMessage = CedarValidators.describeNumberType(this.component);

    validators.push(CedarValidators.forComponent(this.component));
    this.inputValueControl = new FormControl(null, validators);
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
