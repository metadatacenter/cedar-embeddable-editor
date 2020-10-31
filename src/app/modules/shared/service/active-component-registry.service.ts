import {DataObjectService} from './data-object.service';
import {CedarUIComponent} from '../models/ui/cedar-ui-component.model';
import {CedarComponent} from '../models/component/cedar-component.model';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {JsonSchema} from '../models/json-schema.model';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';
import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ActiveComponentRegistryService {

  private modelToUI: Map<CedarComponent, CedarUIComponent> = new Map<CedarComponent, CedarUIComponent>();

  private getUIComponent(component: CedarComponent): CedarUIComponent {
    return this.modelToUI.get(component);
  }

  updateViewToModel(component: CedarComponent, dataObjectService: DataObjectService): void {
    if (component instanceof SingleFieldComponent) {
      const dataObject: object = dataObjectService.getDataPathNode(component.path);
      const uiComponent: CedarUIComponent = this.getUIComponent(component);
      if (uiComponent != null && dataObject != null) {
        uiComponent.setCurrentValue(dataObject[JsonSchema.atValue]);
      }
    } else if (component instanceof MultiFieldComponent) {
      const dataObject: object = dataObjectService.getDataPathNode(component.path);
      const uiComponent: CedarUIComponent = this.getUIComponent(component);
      uiComponent.setCurrentValue(dataObject[component.currentMultiInfo.currentIndex][JsonSchema.atValue]);
    } else if (component instanceof SingleElementComponent || component instanceof MultiElementComponent) {
      for (const childComponent of component.children) {
        this.updateViewToModel(childComponent, dataObjectService);
      }
    }
  }

  registerComponent(modelComponent: CedarComponent, uiComponent: CedarUIComponent): void {
    this.modelToUI.set(modelComponent, uiComponent);
  }

}
