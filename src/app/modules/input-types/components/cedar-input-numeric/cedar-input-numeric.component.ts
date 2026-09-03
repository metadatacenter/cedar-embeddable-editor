import { Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { Numbers } from '../../../shared/models/numbers.model';
import { Xsd } from '../../../shared/models/xsd.model';
import { CedarValidators } from '../../../shared/validation/cedar-validators';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-cedar-input-numeric',
  templateUrl: './cedar-input-numeric.component.html',
  styleUrls: ['./cedar-input-numeric.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputNumericComponent extends CedarUIDirective implements OnInit {
  component!: FieldComponent;
  /*
   * Both built in `ngOnInit`, because the control's validators come off the
   * component and that arrives as an input. Asserted rather than made optional:
   * Angular runs `ngOnInit` before it first checks the template that binds them,
   * so there is no render in which they are absent. The same shape
   * `AbstractAuthorityInputComponent` already uses.
   */
  options!: FormGroup;
  /*
   * Replaced in `ngOnInit` with one carrying the field's validators. It held a
   * `Validators.min(10)` that belonged to no field and could never fire, which
   * was invisible for as long as the group went on holding this control instead
   * of the real one.
   */
  inputValueControl = new FormControl<string | null>(null);
  unitOfMeasure: string | null = null;
  constraintMinValue: number | null = null;
  constraintMaxValue: number | null = null;
  patternErrorMessage: string | null = null;
  @Input({ required: true }) handlerContext!: HandlerContext;

  constructor(
    private readonly fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
    private translateService: TranslateService,
  ) {
    super();
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
      // A field declaring no numeric type has no implicit bounds to take, so the
      // table is not consulted at all rather than indexed by nothing.
      const implicitBounds =
        numberType == null
          ? undefined
          : {
              [Xsd.int]: [Numbers.NUMBER_INT_MIN, Numbers.NUMBER_INT_MAX],
              [Xsd.long]: [Numbers.NUMBER_LONG_MIN, Numbers.NUMBER_LONG_MAX],
              [Xsd.byte]: [Numbers.NUMBER_BYTE_MIN, Numbers.NUMBER_BYTE_MAX],
              [Xsd.short]: [Numbers.NUMBER_SHORT_MIN, Numbers.NUMBER_SHORT_MAX],
            }[numberType];
      if (implicitBounds) {
        // `Number(...)` because the table carries `bigint` for `xsd:long`, whose
        // bounds exceed the safe integer range. The control compares as a number
        // either way; this states the narrowing instead of leaving it implicit.
        this.constraintMinValue = this.constraintMinValue ?? Number(implicitBounds[0]);
        this.constraintMaxValue = this.constraintMaxValue ?? Number(implicitBounds[1]);
      }
    }
    this.patternErrorMessage = CedarValidators.describeNumberType(this.component);

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

  inputChanged($event: Event): void {
    const typed = ($event.target as HTMLTextAreaElement).value;
    this.handlerContext.changeValue(this.component, typed.length === 0 ? null : typed);
  }

  setCurrentValue(currentValue: unknown): void {
    this.inputValueControl.setValue(typeof currentValue === 'string' ? currentValue : null);
  }

  clearValue(): void {
    this.setValueUIAndModel(null);
  }

  private setValueUIAndModel(value: string | null): void {
    this.inputValueControl.setValue(value);
    this.handlerContext.changeValue(this.component, value);
  }

  /**
   * The bounds the template declares, as a hint under the input.
   *
   * Each bound is a translated label rather than an abbreviation assembled
   * here, so the hint reads the way the validation messages beside it do and a
   * language bundle can change it. Only the bounds the template actually
   * declares appear; the implicit range a numeric type carries is resolved in
   * `ngOnInit` for validation and is deliberately not advertised, because a
   * field inherits it whether or not its author thought about it.
   */
  boundsHint(): string {
    const { minValue, maxValue, decimalPlace } = this.component.numberInfo;
    const parts: string[] = [];

    if (minValue != null) {
      parts.push(this.translateService.instant('Hint.Numeric.Minimum', { minValue }));
    }
    if (maxValue != null) {
      parts.push(this.translateService.instant('Hint.Numeric.Maximum', { maxValue }));
    }
    if (decimalPlace != null) {
      parts.push(this.translateService.instant('Hint.Numeric.DecimalPlaces', { decimalPlace }));
    }

    return parts.join(', ');
  }
}
