import { Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { CedarValidators } from '../../../shared/validation/cedar-validators';
import { requireFormArray } from '../../../shared/forms/form-control';
import { InstanceValueNode } from '../../../shared/util/instance-value-node';

@Component({
  selector: 'app-cedar-input-checkbox',
  templateUrl: './cedar-input-checkbox.component.html',
  styleUrls: ['./cedar-input-checkbox.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputCheckboxComponent extends CedarUIDirective implements OnInit {
  component!: FieldComponent;
  options: FormGroup;
  @Input({ required: true }) handlerContext!: HandlerContext;

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
    this.component.choiceInfo.choices.forEach((_choice, index) => {
      this.options.addControl(this.controlNameFor(index), new FormControl());
    });
    if (this.component.valueInfo.requiredValue) {
      // The checkbox group installed no validators at all, so a required
      // checkbox field could never report itself unsatisfied — the data quality
      // report caught it while the widget stayed silent.
      this.options.setValidators(CedarValidators.atLeastOneChecked());
      this.options.updateValueAndValidity({ emitEvent: false });
    }
    this.populateValuesOnLoad();
  }

  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  inputChanged(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    // If readOnly -> revert the change
    if (this.readOnlyMode) {
      const control = this.controlForLabel(checkbox.value);
      control?.setValue(control.value ? null : 'checked');
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.setInput(checkbox.checked, checkbox.value);
  }

  setCurrentValue(currentValue: unknown): void {
    const arrVal = currentValue as Array<string>;

    for (const choice of this.component.choiceInfo.choices) {
      if (arrVal.indexOf(choice.label) >= 0) {
        this.setInput(true, choice.label);
      } else {
        this.setInput(false, choice.label);
      }
    }
  }

  /**
   * The control name for the option at this position.
   *
   * A position, not the option's text. The name used to be the label with its
   * whitespace stripped out, which fails twice over. Angular reads a `.` in a
   * name passed to `FormGroup.get` as a path separator, so `Dr.` — a label real
   * CEDAR templates carry — registered a control that could never be looked up
   * again, and the lookup threw before the tick could reach the instance. And
   * removing the spaces made `New York` and `NewYork` the same name, which
   * `FormGroup.addControl` resolves by silently keeping the control already
   * there, so both boxes drove one control.
   *
   * An index is unique by construction and contains nothing Angular reads as
   * anything else.
   */
  controlNameFor(index: number): string {
    return `choice${index}`;
  }

  /** Whether the box for this option is ticked. */
  isChecked(label: string): boolean {
    return this.controlForLabel(label)?.value === 'checked';
  }

  /** The control behind an option, or null for a label this field does not offer. */
  private controlForLabel(label: string): AbstractControl | null {
    const index = this.component.choiceInfo.choices.findIndex((choice) => choice.label === label);
    return index < 0 ? null : this.options.get(this.controlNameFor(index));
  }

  private populateValuesOnLoad(): void {
    // If the instance already holds values for this field, populate the checkboxes from
    // them rather than writing defaults. Writing defaults here would call changeListValue()
    // with an empty list, overwriting the loaded instance data with [{'@value': null}]
    // before the deferred updateViewToModel() has a chance to apply the real values.
    const dataObject = this.handlerContext.getDataObjectNodeByPath(this.component.path);
    if (Array.isArray(dataObject)) {
      const loadedValues = dataObject
        .map((d) => InstanceValueNode.literal(d))
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

  private setInput(isChecked: boolean, val: string): void {
    const formArray: FormArray = requireFormArray(this.options, 'checkedChoices');
    const control = this.controlForLabel(val);

    /* Selected */
    if (isChecked) {
      // Add a new control in the arrayForm
      if (formArray.value.indexOf(val) < 0) {
        formArray.push(new FormControl(val));
      }
      control?.setValue('checked');
    } else {
      const position = formArray.controls.findIndex((ctrl: AbstractControl) => ctrl.value === val);
      if (position >= 0) {
        formArray.removeAt(position);
      }
      // Outside the removal, because the box and the list are two records of one
      // fact and must agree even when they had already drifted: clearing only
      // where the list still held the label left a ticked box over a selection
      // the model no longer carried.
      control?.setValue(null);
    }

    // Keep the values in the original sort order
    const sortingArr = this.component.choiceInfo.choices.map((a) => a.label);
    formArray.value.sort((a: string, b: string) => sortingArr.indexOf(a) - sortingArr.indexOf(b));
    this.handlerContext.changeListValue(this.component, formArray.value);
  }
}
