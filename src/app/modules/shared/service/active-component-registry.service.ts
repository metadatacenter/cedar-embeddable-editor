import {CedarUIComponent} from '../models/ui/cedar-ui-component.model';
import {CedarComponent} from '../models/component/cedar-component.model';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {JsonSchema} from '../models/json-schema.model';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';
import {Injectable} from '@angular/core';
import {CedarMultiPagerComponent} from '../components/cedar-multi-pager/cedar-multi-pager.component';
import {MultiInstanceObjectInfo} from '../models/info/multi-instance-object-info.model';
import {HandlerContext} from '../util/handler-context';

@Injectable({
  providedIn: 'root',
})
export class ActiveComponentRegistryService {

  private modelToUI: Map<CedarComponent, CedarUIComponent> = new Map<CedarComponent, CedarUIComponent>();
  private modelToMultiPagerUI: Map<CedarComponent, CedarMultiPagerComponent> = new Map<CedarComponent, CedarMultiPagerComponent>();

  private getUIComponent(component: CedarComponent): CedarUIComponent {
    return this.modelToUI.get(component);
  }

  private getMultiPagerUI(component: CedarComponent): CedarMultiPagerComponent {
    return this.modelToMultiPagerUI.get(component);
  }

  updateViewToModel(component: CedarComponent, handlerContext: HandlerContext): void {
    if (component instanceof SingleFieldComponent) {
      const dataObject: object = handlerContext.getDataObjectNodeByPath(component.path);
      const uiComponent: CedarUIComponent = this.getUIComponent(component);
      if (uiComponent != null && dataObject != null) {
        uiComponent.setCurrentValue(dataObject[JsonSchema.atValue]);
      }
    } else if (component instanceof MultiFieldComponent) {
      const dataObject: object = handlerContext.getDataObjectNodeByPath(component.path);
      const uiComponent: CedarUIComponent = this.getUIComponent(component);
      const multiInstanceInfo: MultiInstanceObjectInfo = handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
      uiComponent.setCurrentValue(dataObject[multiInstanceInfo.currentIndex][JsonSchema.atValue]);
      const uiPager = this.getMultiPagerUI(component);
      uiPager.updatePagingUI();
    } else if (component instanceof SingleElementComponent) {
      for (const childComponent of component.children) {
        this.updateViewToModel(childComponent, handlerContext);
      }
    } else if (component instanceof MultiElementComponent) {
      const uiPager = this.getMultiPagerUI(component);
      uiPager.updatePagingUI();
      for (const childComponent of component.children) {
        this.updateViewToModel(childComponent, handlerContext);
      }
    }
  }

  registerComponent(modelComponent: CedarComponent, uiComponent: CedarUIComponent): void {
    this.modelToUI.set(modelComponent, uiComponent);
  }

  registerMultiPagerComponent(modelComponent: CedarComponent, uiComponent: CedarMultiPagerComponent): void {
    this.modelToMultiPagerUI.set(modelComponent, uiComponent);
  }
}
