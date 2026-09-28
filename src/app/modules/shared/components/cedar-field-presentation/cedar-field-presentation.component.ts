import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { HandlerContext } from '../../util/handler-context';
import { decideFieldWidget, FieldWidgetDecision } from '../cedar-component-renderer/component-render-decision';

/** The shared field label, description and value/specification, in CEE and read-only CEF. */
@Component({
  selector: '[cedarFieldPresentation]',
  templateUrl: './cedar-field-presentation.component.html',
  styleUrls: ['./cedar-field-presentation.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFieldPresentationComponent {
  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input() showContent = true;
  @Input() showHeader = true;
  component!: CedarComponent;
  decision: FieldWidgetDecision = { kind: 'none' };

  @Input({ required: true }) set componentToRender(component: CedarComponent) {
    this.component = component;
    this.decision = decideFieldWidget(component);
  }

  get inputType(): string | null {
    return this.decision.kind === 'none' ? null : this.decision.component.basicInfo.inputType;
  }
}
