import { Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { CedarValidators } from '../../../shared/validation/cedar-validators';
import { MatRadioChange } from '@angular/material/radio';

@Component({
  selector: 'app-cedar-input-multiple-choice',
  templateUrl: './cedar-input-multiple-choice.component.html',
  styleUrls: ['./cedar-input-multiple-choice.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputMultipleChoiceComponent extends CedarUIDirective implements OnInit {
  component!: FieldComponent;
  options: FormGroup;
  selectedChoiceInputControl = new FormControl<string | null>(null, null);
  @Input({ required: true }) handlerContext!: HandlerContext;
  /** The last value pushed in by `setCurrentValue`, which is typed `unknown` there. */
  selected: unknown;

  constructor(
    fb: FormBuilder,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
    this.options = fb.group({
      selectedChoiceValue: this.selectedChoiceInputControl,
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    const validators: ValidatorFn[] = [];
    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    validators.push(CedarValidators.forComponent(this.component));
    this.selectedChoiceInputControl.setValidators(validators);
    this.selectedChoiceInputControl.updateValueAndValidity();
  }

  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged(event: MatRadioChange): void {
    if (this.readOnlyMode) {
      this.selectedChoiceInputControl.setValue(typeof this.selected === 'string' ? this.selected : null);
      return;
    }
    this.handlerContext.changeValue(this.component, event.value);
  }

  clearValue(): void {
    this.setValueUIAndModel(null);
  }

  private setValueUIAndModel(value: string | null): void {
    this.selectedChoiceInputControl.setValue(value);
    this.handlerContext.changeValue(this.component, value);
  }

  setCurrentValue(currentValue: unknown): void {
    this.selectedChoiceInputControl.setValue(typeof currentValue === 'string' ? currentValue : null);
    this.selected = currentValue;
  }
}
