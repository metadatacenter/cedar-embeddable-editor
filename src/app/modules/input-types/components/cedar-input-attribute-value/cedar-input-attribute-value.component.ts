import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup, FormGroupDirective, NgForm, Validators} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';
import {MultiFieldComponent} from '../../../shared/models/field/multi-field-component.model';


@Component({
  selector: 'app-cedar-input-attribute-value',
  templateUrl: './cedar-input-attribute-value.component.html',
  styleUrls: ['./cedar-input-attribute-value.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarInputAttributeValueComponent extends CedarUIComponent implements OnInit {

  static readonly DEFAULT_ATTRIBUTE_NAME = 'Attribute Value Field';
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
    this.clearName();
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  nameChanged($event: Event): void {
    const name = ($event.target as HTMLTextAreaElement).value;

    if (name.length === 0) {
      this.clearName();
    }

    // console.log('name changed');
    // console.log(this.options.get('nameInputValue'));
    // console.log(this.options.get('valueInputValue'));
    const value = this.valueInputControl.value;
    this.handlerContext.changeAttributeValue(this.component, name, value);


  }

  valueChanged($event: Event): void {
    let val = ($event.target as HTMLTextAreaElement).value;

    if (val.length === 0) {
      val = null;
    }


    // console.log('value changed');
    // console.log(this.component);
    // console.log(this.handlerContext);
    // console.log(this.activeComponentRegistry);
    const name = this.nameInputControl.value;
    const value = this.valueInputControl.value;
    this.handlerContext.changeAttributeValue(this.component, name, value);


    // this.handlerContext.changeValue(this.component, val);
  }

  setCurrentValue(currentValue: any): void {
    // this.nameInputControl.setValue(currentValue);
  }

  clearName(): void {
    const defName = this.getDefaultName();
    this.nameInputControl.setValue(defName);
    this.handlerContext.changeAttributeValue(this.component, defName, this.valueInputControl.value);
  }

  clearValue(): void {
    // this.setValueUIAndModel(null);
  }


  private getDefaultName(): string {
    const multiField = this.component as MultiFieldComponent;
    const curIndInfo = this.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(multiField);
    return CedarInputAttributeValueComponent.DEFAULT_ATTRIBUTE_NAME + (curIndInfo.currentIndex + 1);
  }

  private setValueUIAndModel(key: string, value: string): void {
    this.nameInputControl.setValue(key);
    this.valueInputControl.setValue(value);
    this.handlerContext.changeAttributeValue(this.component, key, value);
  }

}
