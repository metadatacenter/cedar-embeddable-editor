import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CedarComponent } from '../../models/component/cedar-component.model';
import { ElementComponent } from '../../models/component/element-component.model';
import { SingleElementComponent } from '../../models/element/single-element-component.model';
import { MultiElementComponent } from '../../models/element/multi-element-component.model';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { FieldComponent } from '../../models/component/field-component.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../../models/field/single-field-component.model';
import { HandlerContext } from '../../util/handler-context';
import { StaticFieldComponent } from '../../models/static/static-field-component.model';
import { InputType } from '../../models/input-type.model';
import { MultiComponent } from '../../models/component/multi-component.model';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';

@Component({
  selector: 'app-cedar-component-renderer',
  templateUrl: './cedar-component-renderer.component.html',
  styleUrls: ['./cedar-component-renderer.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarComponentRendererComponent {
  protected readonly InputType = InputType;

  private component!: CedarComponent;
  iterableComponent: ElementComponent | null = null;
  nonIterableComponent: FieldComponent | null = null;
  iterableAsMultiComponent: MultiComponent | null = null;
  /** Null for anything that is not a static field, which the template already tests. */
  staticComponent: StaticFieldComponent | null = null;
  panelOpenState = false;
  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input() showStaticText = false;
  @Input() showAllMultiInstanceValues = false;
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
  constructor() {}

  @Input({ required: true }) set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
    this.iterableComponent = null;
    this.nonIterableComponent = null;
    this.iterableAsMultiComponent = null;
    // Reset alongside the other three. Angular reuses a renderer instance while
    // changing its input, and this one was never cleared — so a static field
    // followed by anything else left the static block rendering underneath it,
    // its `*ngIf` still satisfied by the previous component.
    this.staticComponent = null;
    if (
      componentToRender instanceof SingleElementComponent ||
      componentToRender instanceof MultiElementComponent ||
      componentToRender instanceof CedarTemplate
    ) {
      const elementComponent = componentToRender as ElementComponent;
      if (!elementComponent.hidden) {
        this.iterableComponent = componentToRender as ElementComponent;
      }
    }
    if (componentToRender instanceof SingleFieldComponent || componentToRender instanceof MultiFieldComponent) {
      const fieldComponent = componentToRender as FieldComponent;
      if (!fieldComponent.hidden) {
        this.nonIterableComponent = componentToRender as FieldComponent;
      }
    }
    if (componentToRender instanceof StaticFieldComponent) {
      this.staticComponent = componentToRender as StaticFieldComponent;
    }
    if (this.iterableComponent != null && this.iterableComponent.isMulti()) {
      this.iterableAsMultiComponent = this.iterableComponent as unknown as MultiComponent;
    }
  }

  shouldRenderContentOfIterable(iterableComponent: ElementComponent): boolean {
    if (iterableComponent.isMulti()) {
      const multiElement: MultiElementComponent = iterableComponent as MultiElementComponent;
      if (!this.handlerContext.multiInstanceObjectService.hasMultiInstances(multiElement)) {
        return false;
      }
    }
    return true;
  }

  shouldRenderContentOfNonIterable(nonIterableComponent: FieldComponent): boolean {
    if (nonIterableComponent.isMulti()) {
      const multiField: MultiFieldComponent = nonIterableComponent as MultiFieldComponent;
      if (multiField.isMultiPage() && !this.handlerContext.multiInstanceObjectService.hasMultiInstances(multiField)) {
        return false;
      }
    }
    return true;
  }
}
