import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormArray, FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
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
  activeComponentRegistry: ActiveComponentRegistryService;
  @Input() handlerContext: HandlerContext;

  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
    this.options = fb.group({
      // initialize checked box value holder
      checkedChoices: new FormArray([])
    });
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {
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

    console.log('currentValue:');
    console.log(currentValue);

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
      formArray.push(new FormControl(val));
    }
    /* unselected */
    else {
      // find the unselected element
      let i = 0;

      formArray.controls.forEach((ctrl: FormControl) => {
        if (ctrl.value === val) {
          // Remove the unselected element from the arrayForm
          formArray.removeAt(i);
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
