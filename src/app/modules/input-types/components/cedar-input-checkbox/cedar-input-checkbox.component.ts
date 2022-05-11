import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormArray, FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';

@Component({
  selector: 'app-cedar-input-checkbox',
  templateUrl: './cedar-input-checkbox.component.html',
  styleUrls: ['./cedar-input-checkbox.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarInputCheckboxComponent extends CedarUIComponent implements OnInit {
  component: FieldComponent;
  options: FormGroup;
  @Input() handlerContext: HandlerContext;


  constructor(
    fb: FormBuilder,
    private activeComponentRegistry: ActiveComponentRegistryService
  ) {
    super();
    this.options = fb.group({
      // initialize checked box value holder
      checkedChoices: new FormArray([])
    });
  }

  ngOnInit(): void {
    for (const choice of this.component.choiceInfo.choices) {
      const fc = new FormControl();
      this.options.addControl(this.getFormControlName(choice.label), fc);
    }
    this.populateValuesOnLoad();
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged(event): void {
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
    }
    /* unselected */
    else {
      // find the unselected element
      let i = 0;

      formArray.controls.forEach((ctrl: FormControl) => {
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
    const sortingArr = this.component.choiceInfo.choices.map(a => a.label);
    formArray.value.sort((a, b) => sortingArr.indexOf(a) - sortingArr.indexOf(b));

    this.handlerContext.changeListValue(this.component, formArray.value);
  }

}
