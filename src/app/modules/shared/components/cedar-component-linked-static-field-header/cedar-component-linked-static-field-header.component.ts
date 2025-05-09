import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ComponentDataService } from '../../service/component-data.service';

@Component({
  selector: 'app-cedar-component-linked-static-field-header',
  templateUrl: './cedar-component-linked-static-field-header.component.html',
  styleUrls: ['./cedar-component-linked-static-field-header.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarComponentLinkedStaticFieldHeaderComponent {
  component: CedarComponent;

  constructor(public cds: ComponentDataService) {}

  @Input() set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
  }
}
