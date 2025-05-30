import { Component, Input, ViewEncapsulation } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { StaticFieldComponent } from '../../../shared/models/static/static-field-component.model';

@Component({
  selector: 'app-cedar-static-section-break',
  templateUrl: './cedar-static-section-break.component.html',
  styleUrls: ['./cedar-static-section-break.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarStaticSectionBreakComponent extends CedarUIDirective {
  @Input() handlerContext: HandlerContext;
  component: StaticFieldComponent;
  hasHelpText: boolean = false;

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
    const helpText = componentToRender.labelInfo.description;
    if (helpText && helpText.trim().length > 0) {
      this.hasHelpText = true;
    }
  }

  setCurrentValue(currentValue: any): void {
    // DO NOTHING
  }
}
