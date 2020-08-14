import {Component, Input, OnInit} from '@angular/core';
import {FieldComponent} from '../../models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {JsonPipe} from '@angular/common';
import {ComponentDataService} from '../../service/component-data.service';
import {DataObjectService} from '../../service/data-object.service';

@Component({
  selector: 'app-cedar-input-textfield',
  templateUrl: './cedar-input-textfield.component.html',
  styleUrls: ['./cedar-input-textfield.component.scss'],
  providers: [ComponentDataService]
})
export class CedarInputTextfieldComponent implements OnInit {

  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, Validators.min(10));
  @Input() dataObjectService: DataObjectService;

  constructor(fb: FormBuilder, private jsonPipe: JsonPipe, public cds: ComponentDataService) {
    this.options = fb.group({
      inputValue: this.inputValueControl,
    });
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
  }

  inputChanged($event: Event): void {
    this.dataObjectService.setDataPathValue(this.component, ($event.target as HTMLTextAreaElement).value);
  }
}
