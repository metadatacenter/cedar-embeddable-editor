import { Component, Input, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { StaticFieldComponent } from '../../../shared/models/static/static-field-component.model';

@Component({
  selector: 'app-cedar-foo-bar',
  templateUrl: './cedar-foo-bar.component.html',
  styleUrls: ['./cedar-foo-bar.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFooBarComponent extends CedarUIDirective implements OnInit {
  component: StaticFieldComponent;
  @Input() handlerContext: HandlerContext;

  constructor(
    fb: FormBuilder,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
    this.activeComponentRegistry = activeComponentRegistry;
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  @Input() set componentToRender(componentToRender: StaticFieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  setCurrentValue(_currentValue: any): void {
    // DO NOTHING
  }
}
