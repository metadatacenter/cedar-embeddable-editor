import { Component, Input, OnInit, ViewChild, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormGroupDirective,
  NgForm,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarValidators } from '../../../shared/validation/cedar-validators';

export class TextFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, _form: FormGroupDirective | NgForm | null): boolean {
    return !!(control && control.invalid && (control.dirty || control.touched));
  }
}
@Component({
  selector: 'app-cedar-input-select',
  templateUrl: './cedar-input-select.component.html',
  styleUrls: ['./cedar-input-select.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputSelectComponent extends CedarUIDirective implements OnInit {
  @ViewChild('inputSelect') selectElement: MatSelect;
  readonly ITEM_ID_FIELD = 'id';
  readonly ITEM_TEXT_FIELD = 'label';

  component: FieldComponent;
  dropdownList: Record<string, string>[] = [];
  options: FormGroup;
  /*
   * A string or a list of them: a single-choice field holds the chosen label, a
   * multiple-choice field the chosen labels. `multipleChoice` is what decides
   * which, and the same flag decides how `changeValue` hands it on.
   */
  inputValueControl = new FormControl<string | string[] | null>(null, null);
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

  override ngOnInit(): void {
    super.ngOnInit();
    this.populateItemsOnLoad();
    const validators: ValidatorFn[] = [];

    if (this.component.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    validators.push(CedarValidators.forComponent(this.component));
    this.inputValueControl = new FormControl<string | string[] | null>(null, validators);
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
    this.maxSelections = this.component.multiInfo.maxItems;
  }

  inputChanged(): void {
    const raw = this.inputValueControl.value;
    const multi = this.component.choiceInfo.multipleChoice;
    if (multi) {
      // Inside this branch the control is the multi-select's, so its value is the
      // list. Named separately rather than reused, because the else branch below
      // reads the same control as a single string.
      const values = Array.isArray(raw) ? raw : [];
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
      const value = typeof raw === 'string' ? raw : null;
      this.inputValueControl.setValue(value);
      this.changeValue(value);
    }
  }

  setCurrentValue(currentValue: unknown): void {
    // A multiple-choice field is handed the whole list, a single-choice field one
    // label. Both are values this control holds, which is why its type is the union
    // — narrowing to string alone dropped every multi-select's selection on load.
    const value =
      typeof currentValue === 'string' || Array.isArray(currentValue) ? (currentValue as string | string[]) : null;
    this.inputValueControl.setValue(value);
  }

  private populateItemsOnLoad(): void {
    // `selectedItems` used to be reset to `[]` here for a multi-choice field. It was
    // assigned in this one place and read nowhere — not in the component, not in the
    // template — so it and the `multipleChoice` branch that guarded it are gone.
    for (const choice of this.component.choiceInfo.choices) {
      const entry: Record<string, string> = {
        [this.ITEM_ID_FIELD]: choice.label,
        [this.ITEM_TEXT_FIELD]: choice.label,
      };
      this.dropdownList.push(entry);
    }
  }

  clearValue($event: Event): void {
    $event.stopPropagation();
    this.inputValueControl.setValue(null);
    const multi = this.component.choiceInfo.multipleChoice;
    if (multi) {
      this.changeValue(null);
    } else {
      this.changeValue(null);
    }
  }

  /*
   * A multiple-choice field carries a list and a single-choice field a string, so
   * the parameter is the union and `multipleChoice` is what says which arm applies.
   * The assertions are on that branch rather than on hope: the same flag decides
   * both what the caller passes and which handler is called.
   */
  changeValue(value: string | string[] | null): void {
    const multi = this.component.choiceInfo.multipleChoice;
    if (multi) {
      this.handlerContext.changeListValue(this.component, value as string[]);
    } else {
      this.handlerContext.changeValue(this.component, value as string);
    }
  }
}
