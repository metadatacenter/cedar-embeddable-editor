import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { StaticFieldComponent } from '../../../shared/models/static/static-field-component.model';

@Component({
  selector: 'app-cedar-static-youtube',
  templateUrl: './cedar-static-youtube.component.html',
  styleUrls: ['./cedar-static-youtube.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarStaticYoutubeComponent extends CedarUIDirective {
  component: StaticFieldComponent;
  @Input() handlerContext: HandlerContext;
  videoHeight: number = null;
  videoWidth: number = null;

  constructor(
    fb: FormBuilder,
    public cds: ComponentDataService,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
  }

  @Input() set componentToRender(componentToRender: StaticFieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  setCurrentValue(currentValue: any): void {
    // DO NOTHING
  }
}
