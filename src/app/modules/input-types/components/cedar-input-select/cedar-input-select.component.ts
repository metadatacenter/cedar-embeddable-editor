import { Component, Input, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { CedarUIComponent } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ComponentDataService } from '../../../shared/service/component-data.service';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
@Component({
  selector: 'app-cedar-input-select',
  templateUrl: './cedar-input-select.component.html',
  styleUrls: ['./cedar-input-select.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarInputSelectComponent extends CedarUIComponent implements OnInit {
  @ViewChild('inputSelect') selectElement;
  readonly ITEM_ID_FIELD = 'id';
  readonly ITEM_TEXT_FIELD = 'label';

  component: FieldComponent;
  dropdownList = [];
  selectedItems: any;
  options: FormGroup;
  inputValueControl = new FormControl(null, null);
  errorStateMatcher = new TextFieldErrorStateMatcher();
  selections: string[];
  maxSelections: number;
  @Input() handlerContext: HandlerContext;

  constructor(
    private activeComponentRegistry: ActiveComponentRegistryService,
    public cds: ComponentDataService,
    fb: FormBuilder,
  ) {
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
    this.maxSelections = this.component.multiInfo.maxItems;
  }

  inputChanged(): void {
    const values = this.inputValueControl.value;
    const multi = this.component.choiceInfo.multipleChoice;
    if (multi) {
      if (this.maxSelections === undefined || (values && values.length <= this.maxSelections)) {
        this.selections = values;
      } else {
        this.inputValueControl.setValue(this.selections);
      }
      // close dropdown if max selections reached
      if (this.selectElement && this.maxSelections !== undefined && values && values.length === this.maxSelections) {
        this.selectElement.close();
      }
      this.changeValue(this.selections);
    } else {
      this.inputValueControl.setValue(values);
      this.changeValue(values);
    }
  }

  setCurrentValue(currentValue: any): void {
    this.inputValueControl.setValue(currentValue);
  }

  private populateItemsOnLoad(): void {
    const multi = this.component.choiceInfo.multipleChoice;
    if (multi) {
      this.selectedItems = [];
    }
    for (const choice of this.component.choiceInfo.choices) {
      const entry: { [key: string]: any } = {
        [this.ITEM_ID_FIELD]: choice.label,
        [this.ITEM_TEXT_FIELD]: choice.label,
      };
      this.dropdownList.push(entry);
    }
  }

  clearValue($event): void {
    $event.stopPropagation();
    this.inputValueControl.setValue(null);
    const multi = this.component.choiceInfo.multipleChoice;
    if (multi) {
      this.changeValue(null);
    } else {
      this.changeValue(null);
    }
  }

  changeValue(value): void {
    const multi = this.component.choiceInfo.multipleChoice;
    if (multi) {
      this.handlerContext.changeListValue(this.component, value);
    } else {
      this.handlerContext.changeValue(this.component, value);
    }
  }
}
