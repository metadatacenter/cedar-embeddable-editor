import { componentsAlong, occurrencesOnScreen } from '../../util/component-location';
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  Optional,
} from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { HandlerContext } from '../../util/handler-context';
import { decideFieldWidget, FieldWidgetDecision } from '../cedar-component-renderer/component-render-decision';
import { fieldTypeIcon } from '../../util/field-type-icon';
import { DescriptionLink, FIELD_CONTROLS } from '../../a11y/message-links';
import { FieldComponent } from '../../models/component/field-component.model';
import { StaticFieldComponent } from '../../models/static/static-field-component.model';

/**
 * Where a field's description is in the page: the visually hidden text in its header while editing,
 * or the paragraph read-only rendering draws below the header. At most one of the two is drawn.
 */
const DESCRIPTION_TEXT =
  ':scope > app-cedar-component-header .cee-description, ' +
  ':scope > .child-component-content > app-cedar-field-spec .cee-field-spec-description';

/** The shared field label, description and value/specification, in CEE and read-only CEF. */
@Component({
  selector: '[cedarFieldPresentation]',
  templateUrl: './cedar-field-presentation.component.html',
  styleUrls: ['./cedar-field-presentation.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFieldPresentationComponent implements AfterViewChecked, OnDestroy {
  private readonly description = new DescriptionLink();
  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input() showContent = true;
  @Input() showHeader = true;
  @Input() showFieldType = false;
  component!: CedarComponent;
  decision: FieldWidgetDecision = { kind: 'none' };

  // Optional, so a spec can build the component without a view.
  constructor(@Optional() private readonly elementRef: ElementRef<HTMLElement> | null = null) {}

  @Input({ required: true }) set componentToRender(component: CedarComponent) {
    this.component = component;
    this.decision = decideFieldWidget(component);
  }

  /** The component, where it can state its description as a paragraph below its header, or null. */
  get describedBelow(): FieldComponent | StaticFieldComponent | null {
    const decision = this.decision;
    return decision.kind === 'field' ||
      (decision.kind === 'static' && decision.renderer !== 'image' && decision.renderer !== 'youtube')
      ? decision.component
      : null;
  }

  /**
   * Whether the description is drawn as that paragraph, which only read-only rendering does. The
   * header then leaves out its visually hidden copy, which a screen reader would read as well.
   */
  get descriptionDrawn(): boolean {
    return this.showContent && this.describedBelow !== null && this.handlerContext.readOnlyMode;
  }

  /**
   * Tie the description to the widget's controls, beside whatever else describes them.
   *
   * Read after each render, because a widget draws a different control as its value or its mode
   * changes, and a control drawn afresh carries none of the ids its predecessor did.
   */
  ngAfterViewChecked(): void {
    const host = this.elementRef?.nativeElement;
    const text = host?.querySelector(DESCRIPTION_TEXT);
    const widget = host?.querySelector(':scope > .child-component-content > app-cedar-field-widget');
    this.description.set(text?.id || null, widget ? [...widget.querySelectorAll(FIELD_CONTROLS)] : []);
  }

  ngOnDestroy(): void {
    this.description.clear();
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
