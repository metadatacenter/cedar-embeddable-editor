import {Component, Input, OnInit} from '@angular/core';
import {FieldComponent} from '../../models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ComponentDataService} from '../../service/component-data.service';
import {DataObjectService} from '../../service/data-object.service';
import {CedarUIComponent} from '../../models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';

@Component({
  selector: 'app-cedar-input-numeric',
  templateUrl: './cedar-input-numeric.component.html',
  styleUrls: ['./cedar-input-numeric.component.scss']
})
export class CedarInputNumericComponent extends CedarUIComponent implements OnInit {

  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, Validators.min(10));
  dataObject: DataObjectService;
  activeComponentRegistry: ActiveComponentRegistryService;

  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  @Input() set dataObjectService(dataObjectService: DataObjectService) {
    this.dataObject = dataObjectService;
  }

  inputChanged($event: Event): void {
    this.dataObject.setDataPathValue(this.component, ($event.target as HTMLTextAreaElement).value);
  }

  setCurrentValue(currentValue: any): void {
    this.inputValueControl.setValue(currentValue);
  }

}
