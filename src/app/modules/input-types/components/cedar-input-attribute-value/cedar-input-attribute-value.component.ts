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

  nameChanged($event: Event): void {
    let name: string | null = null;

    if ($event) {
      name = ($event.target as HTMLTextAreaElement).value;
    } else {
      name = this.nameInputControl.value;
    }
    const value = this.valueInputControl.value;
    this.handlerContext.changeAttributeValue(this.component, name, value);
    this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
  }

  valueChanged($event: Event): void {
    let value: string | null = null;

    if ($event) {
      value = ($event.target as HTMLTextAreaElement).value;
    } else {
      value = this.valueInputControl.value;
    }

    if (value && value.length === 0) {
      value = null;
    }
    const name = this.nameInputControl.value;
    this.handlerContext.changeAttributeValue(this.component, name, value);
  }

  /*
   * An attribute-value occurrence arrives as a one-entry view object: the
   * attribute's name is the key and its value is the value. This is deliberately
   * not an `InstanceDataContainer`: the registry has already projected the two
   * pieces the widget needs from the model-library instance.
   */
  setCurrentValue(currentValue: unknown): void {
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
    this.handlerContext.changeAttributeValue(this.component, null, this.valueInputControl.value);
  }

  clearValue(): void {
    this.valueInputControl.setValue(null);
    this.handlerContext.changeAttributeValue(this.component, this.nameInputControl.value, null);
  }
}
