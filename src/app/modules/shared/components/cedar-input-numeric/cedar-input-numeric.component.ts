import {Component, Input, OnInit} from '@angular/core';
import {FieldComponent} from '../../models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {JsonPipe} from '@angular/common';
import {ComponentDataService} from '../../service/component-data.service';

@Component({
  selector: 'app-cedar-input-numeric',
  templateUrl: './cedar-input-numeric.component.html',
  styleUrls: ['./cedar-input-numeric.component.scss'],
  providers: [ComponentDataService]
})
export class CedarInputNumericComponent implements OnInit {

  component: FieldComponent;
  options: FormGroup;
  inputValueControl = new FormControl(null, Validators.min(10));

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

}
