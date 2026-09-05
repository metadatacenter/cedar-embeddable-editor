import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';

/** The one name/value pair the attribute-value widget displays at a time. */
type AttributeValueView = Record<string, string | null>;

function isAttributeValueView(value: unknown): value is AttributeValueView {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return entries.length === 1 && (typeof entries[0][1] === 'string' || entries[0][1] === null);
}

@Component({
  selector: 'app-cedar-input-attribute-value',
  templateUrl: './cedar-input-attribute-value.component.html',
  styleUrls: ['./cedar-input-attribute-value.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputAttributeValueComponent extends CedarUIDirective {
  component!: FieldComponent;
  options: FormGroup;
  nameInputControl = new FormControl<string | null>(null, null);
  valueInputControl = new FormControl<string | null>(null, null);
  attributeNameError: string | null = null;
  @Input({ required: true }) handlerContext!: HandlerContext;

  constructor(
    fb: FormBuilder,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
    this.options = fb.group({
      nameInputValue: this.nameInputControl,
      valueInputValue: this.valueInputControl,
    });
  }
  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  /**
   * The name box was typed into or left.
   *
   * Nothing to record while the form is read-only. `readonly` on the input stops
   * keystrokes and nothing else: the blur this is also bound to still arrives,
   * and it used to rewrite the slot — dropping the field's own context term on
   * the way — so tabbing through a read-only form published a change event
   * carrying an instance nobody had edited.
   */
  nameChanged($event: Event): void {
    if (this.readOnlyMode) {
      return;
    }
    let name: string | null = null;

    if ($event) {
      name = ($event.target as HTMLTextAreaElement).value;
    } else {
      name = this.nameInputControl.value;
    }
    const value = this.valueInputControl.value;
    this.attributeNameError = this.handlerContext.changeAttributeValue(this.component, name, value);
    this.nameInputControl.setErrors(this.attributeNameError === null ? null : { attributeName: true });
    if (this.attributeNameError !== null) {
      this.nameInputControl.markAsTouched();
    }
    if (this.attributeNameError === null) {
      this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
    }
  }

  valueChanged($event: Event): void {
    if (this.readOnlyMode) {
      return;
    }
    const typed = $event ? ($event.target as HTMLTextAreaElement).value : this.valueInputControl.value;

    // An emptied box says so as null, which is how the other nine widgets say it
    // and what this widget's own Clear action has always passed. The guard that
    // meant to do this read `value && value.length === 0` and could not run,
    // since `''` is falsy — so an emptied box reached the model as `''` and was
    // recorded as `{"@value": ""}`.
    //
    // `changeAttributeValue` folds the empty string in as well. That is the model
    // boundary refusing a shape it cannot mean; this is the widget reporting what
    // happened in the vocabulary its siblings use. Neither makes the other
    // redundant.
    const value = typed === '' ? null : typed;
    const name = this.nameInputControl.value;
    this.attributeNameError = this.handlerContext.changeAttributeValue(this.component, name, value);
    this.nameInputControl.setErrors(this.attributeNameError === null ? null : { attributeName: true });
    if (this.attributeNameError !== null) {
      this.nameInputControl.markAsTouched();
    }
  }

  /*
   * An attribute-value occurrence arrives as a one-entry view object: the
   * attribute's name is the key and its value is the value. This is deliberately
   * not an `InstanceDataContainer`: the registry has already projected the two
   * pieces the widget needs from the model-library instance.
   */
  setCurrentValue(currentValue: unknown): void {
    this.attributeNameError = null;
    this.nameInputControl.setErrors(null);
    if (!isAttributeValueView(currentValue)) {
      this.nameInputControl.setValue(null);
      this.valueInputControl.setValue(null);
      return;
    }
    const [name, value] = Object.entries(currentValue)[0];
    this.nameInputControl.setValue(name);
    this.valueInputControl.setValue(value);
  }

  override deleteCurrentValue(): void {
    const name = this.nameInputControl.value;
    this.handlerContext.deleteAttributeValue(this.component, name);
  }

  clearName(): void {
    this.nameInputControl.setValue(null);
    this.attributeNameError = this.handlerContext.changeAttributeValue(
      this.component,
      null,
      this.valueInputControl.value,
    );
    this.nameInputControl.setErrors(null);
  }

  clearValue(): void {
    this.valueInputControl.setValue(null);
    this.handlerContext.changeAttributeValue(this.component, this.nameInputControl.value, null);
  }
}
