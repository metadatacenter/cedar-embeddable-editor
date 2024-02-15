import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ComponentDataService } from '../../service/component-data.service';

@Component({
  selector: 'app-cedar-component-linked-static-field-header',
  templateUrl: './cedar-component-linked-static-field-header.component.html',
  styleUrls: ['./cedar-component-linked-static-field-header.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarComponentLinkedStaticFieldHeaderComponent implements OnInit {
  component: CedarComponent;

  constructor(public cds: ComponentDataService) {}

  ngOnInit(): void {}

  @Input() set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
  }
}
