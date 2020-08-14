import {Component, Input, OnInit} from '@angular/core';
import {CedarComponent} from '../../models/component/cedar-component.model';
import {ComponentDataService} from '../../service/component-data.service';
import {MultiElementComponent} from '../../models/element/multi-element-component.model';
import {MultiFieldComponent} from '../../models/field/multi-field-component.model';
import {MultiComponent} from '../../models/component/multi-component.model';

@Component({
  selector: 'app-cedar-component-header',
  templateUrl: './cedar-component-header.component.html',
  styleUrls: ['./cedar-component-header.component.scss']
})
export class CedarComponentHeaderComponent implements OnInit {

  component: CedarComponent;
  multiComponent: MultiComponent;

  constructor(public cds: ComponentDataService) {
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
    if (componentToRender instanceof MultiFieldComponent ||
      componentToRender instanceof MultiElementComponent) {
      this.multiComponent = componentToRender as MultiComponent;
    } else {
      this.multiComponent = null;
    }
  }

}
