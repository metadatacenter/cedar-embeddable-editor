import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ComponentDataService } from '../../service/component-data.service';
import { MultiComponent } from '../../models/component/multi-component.model';
import { ComponentTypeHandler } from '../../handler/component-type.handler';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';

@Component({
  selector: 'app-cedar-component-header',
  templateUrl: './cedar-component-header.component.html',
  styleUrls: ['./cedar-component-header.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarComponentHeaderComponent implements OnInit {
  component: CedarComponent;
  multiComponent: MultiComponent;
  shouldRenderRequiredMark = false;
  @Input() readOnlyMode;

  constructor(public cds: ComponentDataService) {}

  ngOnInit(): void {}

  @Input() set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
    if (ComponentTypeHandler.isMulti(componentToRender)) {
      this.multiComponent = componentToRender as MultiComponent;
      if (this.multiComponent instanceof MultiFieldComponent) {
        const _multiToFieldComp = this.multiComponent as MultiFieldComponent;
        if (_multiToFieldComp.valueInfo.requiredValue) {
          this.shouldRenderRequiredMark = true;
        }
      }
    } else {
      this.multiComponent = null;
    }
    if (this.component instanceof SingleFieldComponent) {
      const fieldComp = this.component as unknown as FieldComponent;
      if (fieldComp.valueInfo.requiredValue) {
        this.shouldRenderRequiredMark = true;
      }
    }
  }
}
