import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
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
import {StaticFieldComponent} from '../../models/static/static-field-component.model';
import {InputType} from '../../models/input-type.model';

@Component({
  selector: 'app-cedar-component-renderer',
  templateUrl: './cedar-component-renderer.component.html',
  styleUrls: ['./cedar-component-renderer.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarComponentRendererComponent implements OnInit {

  protected readonly InputType = InputType;

  private component: CedarComponent;
  iterableComponent: ElementComponent;
  nonIterableComponent: FieldComponent;
  staticComponent: StaticFieldComponent;
  multiInfo: MultiInfo;
  panelOpenState: boolean;
  @Input() handlerContext: HandlerContext;
  // tslint:disable-next-line:variable-name
  private _allExpanded = false;
  @Input()
  get allExpanded(): boolean { return this._allExpanded; }
  set allExpanded(allExpanded: boolean){
    this.panelOpenState = allExpanded;
    this._allExpanded = allExpanded;
  }
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
    if (componentToRender instanceof StaticFieldComponent) {
      this.staticComponent = componentToRender as StaticFieldComponent;
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
