import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators} from '@angular/forms';
import {ErrorStateMatcher} from '@angular/material/core';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}

@Component({
  selector: 'app-cedar-input-select',
  templateUrl: './cedar-input-select.component.html',
  styleUrls: ['./cedar-input-select.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarInputSelectComponent extends CedarUIComponent implements OnInit {
  readonly ITEM_ID_FIELD = 'id';
  readonly ITEM_TEXT_FIELD = 'label';

  component: FieldComponent;
  dropdownList = [];
  selectedItems: any;
  options: FormGroup;
  inputValueControl = new FormControl(null, null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  @Input() handlerContext: HandlerContext;


  constructor(private activeComponentRegistry: ActiveComponentRegistryService, public cds: ComponentDataService, fb: FormBuilder) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }

  ngOnInit(): void {
    this.populateItemsOnLoad();
    const validators: any[] = [];

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    this.inputValueControl = new FormControl(null, validators);
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged(event): void {
    const values = [];

    if (Array.isArray(this.selectedItems) && this.selectedItems.length > 0) {
      values.push(...this.selectedItems.map(a => a[this.ITEM_ID_FIELD]));
    } else if (this.selectedItems && this.selectedItems.hasOwnProperty(this.ITEM_ID_FIELD)) {
      values.push(this.selectedItems[this.ITEM_ID_FIELD]);
    } else {
      values.push(null);
    }

    const multi = this.component.choiceInfo.multipleChoice;

    if (multi) {
      this.handlerContext.changeListValue(this.component, values);
    } else {
      this.handlerContext.changeValue(this.component, values[0]);
    }
  }

  setCurrentValue(currentValue: any): void {
    if (!Array.isArray(currentValue)) {
      currentValue = [currentValue];
    }
    this.selectedItems = null;
    const multi = this.component.choiceInfo.multipleChoice;

    if (multi) {
      this.selectedItems = [];
    }
    currentValue.forEach((val: string) => {
      if (val) {
        const entry = {};
        entry[this.ITEM_ID_FIELD] = val;
        entry[this.ITEM_TEXT_FIELD] = val;

        if (multi) {
          this.selectedItems.push(entry);
        } else {
          this.selectedItems = entry;
        }
      }
    });
  }

  private populateItemsOnLoad(): void {
    const multi = this.component.choiceInfo.multipleChoice;
    if (multi) {
      this.selectedItems = [];
    }

    for (const choice of this.component.choiceInfo.choices) {
      const entry = {};
      entry[this.ITEM_ID_FIELD] = choice.label;
      entry[this.ITEM_TEXT_FIELD] = choice.label;
      this.dropdownList.push(entry);

      if (choice.selectedByDefault) {
        if (multi) {
          this.selectedItems.push(entry);
        } else {
          this.selectedItems = entry;
        }
      }
    }
    this.inputChanged(null);
  }

  clearValue(): void {
    this.inputValueControl.setValue(null);
    this.handlerContext.changeControlledValue(this.component, null, null);
  }

}
