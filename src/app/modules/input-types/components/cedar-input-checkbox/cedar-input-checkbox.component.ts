import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { JsonSchema } from 'cedar-model-typescript-library';
import { CedarValidators } from '../../../shared/validation/cedar-validators';

@Component({
    selector: 'app-cedar-input-checkbox',
    templateUrl: './cedar-input-checkbox.component.html',
    styleUrls: ['./cedar-input-checkbox.component.scss'],
    encapsulation: ViewEncapsulation.Emulated,
    standalone: false
})
export class CedarInputCheckboxComponent extends CedarUIDirective implements OnInit {
  component: FieldComponent;
  options: FormGroup;
  @Input() handlerContext: HandlerContext;

  constructor(
    fb: FormBuilder,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
    this.options = fb.group({
      // initialize checked box value holder
      checkedChoices: new FormArray([]),
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    for (const choice of this.component.choiceInfo.choices) {
      const fc = new FormControl();
      this.options.addControl(this.getFormControlName(choice.label), fc);
    }
    if (this.component.valueInfo.requiredValue) {
      // The checkbox group installed no validators at all, so a required
      // checkbox field could never report itself unsatisfied — the data quality
      // report caught it while the widget stayed silent.
      this.options.setValidators(CedarValidators.atLeastOneChecked());
      this.options.updateValueAndValidity({ emitEvent: false });
    }
    this.populateValuesOnLoad();
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged(event): void {
    // If readOnly -> revert the change
    if (this.readOnlyMode) {
      const name = event.target.value;
      const val = this.options.get(this.getFormControlName(name)).value;
      this.options.get(this.getFormControlName(name)).setValue(!val);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.setInput(event.target.checked, event.target.value);
  }

  setCurrentValue(currentValue: any): void {
    const arrVal = currentValue as Array<string>;

    for (const choice of this.component.choiceInfo.choices) {
      if (arrVal.indexOf(choice.label) >= 0) {
        this.setInput(true, choice.label);
      } else {
        this.setInput(false, choice.label);
      }
    }
  }

  getFormControlName(val): string {
    return val.replace(/\s+/g, '');
  }

  private populateValuesOnLoad(): void {
    // If the instance already holds values for this field, populate the checkboxes from
    // them rather than writing defaults. Writing defaults here would call changeListValue()
    // with an empty list, overwriting the loaded instance data with [{'@value': null}]
    // before the deferred updateViewToModel() has a chance to apply the real values.
    const dataObject = this.handlerContext.getDataObjectNodeByPath(this.component.path);
    if (Array.isArray(dataObject)) {
      const loadedValues = dataObject
        .map((d) => (d ? d[JsonSchema.atValue] : null))
        .filter((v) => v !== null && v !== undefined);
      if (loadedValues.length > 0) {
        this.setCurrentValue(loadedValues);
        return;
      }
    }
    for (const choice of this.component.choiceInfo.choices) {
      this.setInput(choice.selectedByDefault, choice.label);
    }
  }

  private setInput(isChecked, val): void {
    const formArray: FormArray = this.options.get('checkedChoices') as FormArray;

    /* Selected */
    if (isChecked) {
      // Add a new control in the arrayForm
      if (formArray.value.indexOf(val) < 0) {
        formArray.push(new FormControl(val));
      }
      this.options.get(this.getFormControlName(val)).setValue('checked');
    } else {
      /* unselected */
      // find the unselected element
      let i = 0;

      formArray.controls.forEach((ctrl: AbstractControl) => {
        if (ctrl.value === val) {
          // Remove the unselected element from the arrayForm
          formArray.removeAt(i);
          this.options.get(this.getFormControlName(val)).setValue(null);
          return;
        }
        i++;
      });
    }

    // Keep the values in the original sort order
    const sortingArr = this.component.choiceInfo.choices.map((a) => a.label);
    formArray.value.sort((a, b) => sortingArr.indexOf(a) - sortingArr.indexOf(b));
    this.handlerContext.changeListValue(this.component, formArray.value);
  }
}
