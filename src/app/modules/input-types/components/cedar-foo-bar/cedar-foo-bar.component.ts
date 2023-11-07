import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { CedarUIComponent } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { StaticFieldComponent } from '../../../shared/models/static/static-field-component.model';

@Component({
  selector: 'app-cedar-foo-bar',
  templateUrl: './cedar-foo-bar.component.html',
  styleUrls: ['./cedar-foo-bar.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarFooBarComponent extends CedarUIComponent implements OnInit {
  component: StaticFieldComponent;
  @Input() handlerContext: HandlerContext;

  constructor(
    fb: FormBuilder,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {}

  @Input() set componentToRender(componentToRender: StaticFieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setCurrentValue(currentValue: any): void {
    // DO NOTHING
  }
}
