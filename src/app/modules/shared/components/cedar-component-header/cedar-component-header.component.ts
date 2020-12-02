import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {CedarComponent} from '../../models/component/cedar-component.model';
import {ComponentDataService} from '../../service/component-data.service';
import {MultiComponent} from '../../models/component/multi-component.model';
import {ComponentTypeHandler} from '../../handler/component-type.handler';

@Component({
  selector: 'app-cedar-component-header',
  templateUrl: './cedar-component-header.component.html',
  styleUrls: ['./cedar-component-header.component.scss'],
  encapsulation: ViewEncapsulation.None
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
    if (ComponentTypeHandler.isMulti(componentToRender)) {
      this.multiComponent = componentToRender as MultiComponent;
    } else {
      this.multiComponent = null;
    }
  }

}
