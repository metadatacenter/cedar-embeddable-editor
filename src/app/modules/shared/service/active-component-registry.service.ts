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
    // console.log('ActiveComponentRegistryService.getUIComponent');
    // console.log(this.modelToUI.size);
    return this.modelToUI.get(component);
  }

  updateViewToModel(component: CedarComponent, dataObjectService: DataObjectService): void {
    // console.log('ActiveComponentRegistryService.updateViewToModel');
    // console.log(this.getUIComponent(component));
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
    // console.log('ActiveComponentRegistryService.registerComponent');
    // console.log(modelComponent);
    // console.log(uiComponent);
    this.modelToUI.set(modelComponent, uiComponent);
    // console.log(this.modelToUI.size);
  }

}
