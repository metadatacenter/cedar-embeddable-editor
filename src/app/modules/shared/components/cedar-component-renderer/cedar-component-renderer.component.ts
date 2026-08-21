import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ElementComponent } from '../../models/component/element-component.model';
import { MultiElementComponent } from '../../models/element/multi-element-component.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { HandlerContext } from '../../util/handler-context';
import { InputType } from '../../models/input-type.model';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { ComponentRenderDecision, decideComponentRender } from './component-render-decision';

@Component({
  selector: 'app-cedar-component-renderer',
  templateUrl: './cedar-component-renderer.component.html',
  styleUrls: ['./cedar-component-renderer.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarComponentRendererComponent implements OnChanges {
  renderDecision: ComponentRenderDecision | null = null;
  panelOpenState = false;
  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input({ required: true }) pageBreakPaginatorService!: PageBreakPaginatorService;
  // tslint:disable-next-line:variable-name
  private _allExpanded = false;
  @Input()
  get allExpanded(): boolean {
    return this._allExpanded;
  }

  set allExpanded(allExpanded: boolean) {
    this.panelOpenState = allExpanded;
    this._allExpanded = allExpanded;
  }
  @Input({ required: true }) set componentToRender(componentToRender: CedarComponent) {
    this.renderDecision = decideComponentRender(componentToRender);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['componentToRender'] && this.renderDecision?.kind === 'unsupported') {
      this.handlerContext.messageHandlerService.error(this.renderDecision.reason);
    }
  }

  shouldRenderContentOfIterable(iterableComponent: ElementComponent): boolean {
    if (iterableComponent instanceof MultiElementComponent) {
      if (!this.handlerContext.multiInstanceObjectService.hasMultiInstances(iterableComponent)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Whether to draw the occurrence pager for a repeating field.
   *
   * It exists to move between occurrences, so it earns its place when there are occurrences to move
   * between. Reading a template on its own there are none: every occurrence the bounds imply is
   * empty and identical, and the chips sit on the field's title row where they collide with the
   * specification. An instance keeps its pager — that is how a reader reaches occurrence two.
   */
  shouldRenderOccurrencePager(): boolean {
    return !this.handlerContext.statesSpecification;
  }

  /**
   * Whether to state the specification in place of the control.
   *
   * Reading a template there is nothing to hold, so the box says what a value must be instead — and
   * it has to replace the control rather than annotate it, because a placeholder is one line and
   * cannot carry a link. Two widgets keep theirs: a radio or checkbox group is its own set of options,
   * which is the form a reader wants to see, and it has no box to put anything in.
   */
  showSpecInsteadOfControl(nonIterableComponent: FieldComponent): boolean {
    if (!this.handlerContext.statesSpecification) {
      return false;
    }
    const inputType = nonIterableComponent.basicInfo.inputType;
    return inputType !== InputType.radio && inputType !== InputType.checkbox && inputType !== InputType.attributeValue;
  }

  shouldRenderContentOfNonIterable(nonIterableComponent: FieldComponent): boolean {
    if (nonIterableComponent instanceof MultiFieldComponent) {
      if (
        nonIterableComponent.isMultiPage() &&
        !this.handlerContext.multiInstanceObjectService.hasMultiInstances(nonIterableComponent)
      ) {
        // Editing, an unoccupied repeating field is its add control and nothing else, which is right:
        // there is no occurrence to show until someone adds one. Reading a template, the same field
        // showed a name and a blank, so what it will look like was the one thing missing.
        return this.handlerContext.statesSpecification;
      }
    }
    return true;
  }
}
