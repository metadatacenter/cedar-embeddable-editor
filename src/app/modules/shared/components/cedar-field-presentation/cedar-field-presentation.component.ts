import { componentsAlong, occurrencesOnScreen } from '../../util/component-location';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { HandlerContext } from '../../util/handler-context';
import { decideFieldWidget, FieldWidgetDecision } from '../cedar-component-renderer/component-render-decision';
import { fieldTypeIcon } from '../../util/field-type-icon';

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
  @Input() showFieldType = false;
  component!: CedarComponent;
  decision: FieldWidgetDecision = { kind: 'none' };

  @Input({ required: true }) set componentToRender(component: CedarComponent) {
    this.component = component;
    this.decision = decideFieldWidget(component);
  }

  get inputType(): string | null {
    return this.decision.kind === 'none' ? null : this.decision.component.basicInfo.inputType;
  }

  get warningOnly(): boolean {
    const context = this.handlerContext;
    if (context.readOnlyMode) return false;
    const chain = componentsAlong(context.dataContext.templateRepresentation, this.component.path) ?? [];
    const current = occurrencesOnScreen(chain, context.multiInstanceObjectService);
    const above = occurrencesOnScreen(chain.slice(0, -1), context.multiInstanceObjectService);
    const same = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((v, i) => v === b[i]);
    const problems = (context.dataContext.dataQualityReport?.problems ?? []).filter(
      (p) =>
        same(p.path, this.component.path) &&
        same(p.occurrences, p.code === 'required' || p.code === 'minItems' || p.code === 'maxItems' ? above : current),
    );
    return problems.some((p) => p.severity === 'warning') && !problems.some((p) => p.severity === 'error');
  }

  readonly typeIcon = fieldTypeIcon;
}
