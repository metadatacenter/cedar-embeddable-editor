import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';


@Component({
  selector: 'app-cedar-input-attribute-value',
  templateUrl: './cedar-input-attribute-value.component.html',
  styleUrls: ['./cedar-input-attribute-value.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarInputAttributeValueComponent extends CedarUIComponent implements OnInit {

  component: FieldComponent;
  options: FormGroup;
  nameInputControl = new FormControl(null, null);
  valueInputControl = new FormControl(null, null);
  activeComponentRegistry: ActiveComponentRegistryService;
  @Input() handlerContext: HandlerContext;

  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
    this.options = fb.group({
      nameInputValue: this.nameInputControl,
      valueInputValue: this.valueInputControl,
    });
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  nameChanged($event: Event): void {
    let name: string = null;

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
    let value: string = null;

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

  setCurrentValue(currentValue: any): void {
    this.nameInputControl.setValue(Object.keys(currentValue)[0]);
    this.valueInputControl.setValue(Object.values(currentValue)[0]);
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
