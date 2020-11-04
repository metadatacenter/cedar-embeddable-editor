import {Component, Input, OnInit} from '@angular/core';
import {CedarComponent} from '../../models/component/cedar-component.model';
import {ElementComponent} from '../../models/component/element-component.model';
import {SingleElementComponent} from '../../models/element/single-element-component.model';
import {MultiElementComponent} from '../../models/element/multi-element-component.model';
import {CedarTemplate} from '../../models/template/cedar-template.model';
import {FieldComponent} from '../../models/component/field-component.model';
import {MultiFieldComponent} from '../../models/field/multi-field-component.model';
import {SingleFieldComponent} from '../../models/field/single-field-component.model';
import {MultiInfo} from '../../models/info/multi-info.model';
import {HandlerContext} from '../../util/handler-context';
import {DataContext} from '../../util/data-context';

@Component({
  selector: 'app-cedar-component-renderer',
  templateUrl: './cedar-component-renderer.component.html',
  styleUrls: ['./cedar-component-renderer.component.scss']
})
export class CedarComponentRendererComponent implements OnInit {

  private component: CedarComponent;
  iterableComponent: ElementComponent;
  nonIterableComponent: FieldComponent;
  multiInfo: MultiInfo;
  @Input() handlerContext: HandlerContext;

  constructor() {
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: CedarComponent) {
    this.component = componentToRender;
    this.iterableComponent = null;
    this.nonIterableComponent = null;
    if (componentToRender instanceof SingleElementComponent ||
      componentToRender instanceof MultiElementComponent ||
      componentToRender instanceof CedarTemplate) {
      this.iterableComponent = componentToRender as ElementComponent;
      if (componentToRender instanceof MultiElementComponent) {
        this.multiInfo = (componentToRender as MultiElementComponent).multiInfo;
      }
    }
    if (componentToRender instanceof SingleFieldComponent ||
      componentToRender instanceof MultiFieldComponent) {
      this.nonIterableComponent = componentToRender as FieldComponent;
      if (componentToRender instanceof MultiFieldComponent) {
        this.multiInfo = (componentToRender as MultiFieldComponent).multiInfo;
      }
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
      if (!this.handlerContext.multiInstanceObjectService.hasMultiInstances(multiField)) {
        return false;
      }
    }
    return true;
  }

}
