import {Component, Input, OnInit} from '@angular/core';
import {FieldComponent} from '../../models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {JsonPipe} from '@angular/common';
import {ComponentDataService} from '../../service/component-data.service';
import {DataObjectService} from '../../service/data-object.service';
import {CedarUIComponent} from '../../models/ui/cedar-ui-component.model';

@Component({
  selector: 'app-cedar-input-textfield',
  templateUrl: './cedar-input-textfield.component.html',
  styleUrls: ['./cedar-input-textfield.component.scss'],
  providers: [ComponentDataService]
})
export class CedarInputTextfieldComponent extends CedarUIComponent implements OnInit {

  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, Validators.min(10));
  dataObject: DataObjectService;

  constructor(fb: FormBuilder, private jsonPipe: JsonPipe, public cds: ComponentDataService) {
    super();
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    componentToRender.setUIComponent(this);
  }

  @Input() set dataObjectService(dataObjectService: DataObjectService) {
    this.dataObject = dataObjectService;
  }

  inputChanged($event: Event): void {
    this.dataObject.setDataPathValue(this.component, ($event.target as HTMLTextAreaElement).value);
  }

  setCurrentValue(currentValue: any): void {
    console.log('CedarInputTextfieldComponent.setCurrentValue');
    this.inputValueControl.setValue(currentValue);
  }

}
