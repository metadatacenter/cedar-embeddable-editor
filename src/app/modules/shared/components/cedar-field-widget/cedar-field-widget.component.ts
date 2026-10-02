import { ChangeDetectionStrategy, Component, DoCheck, Input, ViewEncapsulation } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { InputType } from '../../models/input-type.model';
import { HandlerContext } from '../../util/handler-context';
import { InstanceValueNode } from '../../util/instance-value-node';
import { decideFieldWidget, FieldWidgetDecision } from '../cedar-component-renderer/component-render-decision';

/**
 * Routes one field to its value control, static content or read-only specification.
 * The shared CedarFieldPresentationComponent supplies the label and description in CEE
 * and read-only CEF. Editable CEF uses this bare control directly.
 */
@Component({
  selector: 'app-cedar-field-widget',
  templateUrl: './cedar-field-widget.component.html',
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFieldWidgetComponent implements DoCheck {
  widgetDecision: FieldWidgetDecision = { kind: 'none' };

  /**
   * Whether the control is standing in for a statement of what the field will accept.
   *
   * Held rather than asked for in the template, and the difference is not tidiness.
   * Angular checks a binding twice in development — once to render and once to prove
   * nothing moved — and this answer is drawn from the instance, which a host assigning
   * a value moves between the two. Computed in `ngDoCheck`, which the verifying pass
   * does not re-run, it is one answer per cycle instead of two that can disagree. It
   * also stops a tree walk happening on every pass over every field of a form.
   */
  showsSpecification = false;

  @Input({ required: true }) handlerContext!: HandlerContext;

  @Input({ required: true }) set componentToRender(componentToRender: CedarComponent) {
    this.widgetDecision = decideFieldWidget(componentToRender);
  }

  ngDoCheck(): void {
    this.showsSpecification =
      this.widgetDecision.kind === 'field' && this.showSpecInsteadOfControl(this.widgetDecision.component);
  }

  /**
   * Whether to state the specification in place of the control.
   *
   * Reading a template, or an unfilled field in a read-only instance, there is nothing to hold, so
   * the box says what a value must be instead. It has to replace the control rather than annotate
   * it: a native placeholder is one indivisible string, so it cannot italicize just `min`, `max`,
   * `unit`, and the other specification keywords. A populated instance keeps its value widget.
   *
   * Three widgets keep theirs even when empty: a radio or checkbox group is its own set of options,
   * which is the form a reader wants to see, and an attribute-value field is a container rather than
   * one value that can be summarized in this box.
   */
  private showSpecInsteadOfControl(fieldComponent: FieldComponent): boolean {
    const statesUnfilledField =
      this.handlerContext.statesSpecification ||
      (this.handlerContext.readOnlyMode &&
        !InstanceValueNode.holdsValue(this.handlerContext.getDataObjectNodeByPath(fieldComponent.path)));
    if (!statesUnfilledField) {
      return false;
    }
    const inputType = fieldComponent.basicInfo.inputType;
    return inputType !== InputType.radio && inputType !== InputType.checkbox && inputType !== InputType.attributeValue;
  }
}
