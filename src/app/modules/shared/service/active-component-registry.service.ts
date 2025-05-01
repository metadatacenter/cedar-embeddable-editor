import { CedarUIDirective } from '../models/ui/cedar-ui-component.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { JsonSchema } from '../models/json-schema.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { Injectable } from '@angular/core';
import { CedarMultiPagerComponent } from '../components/cedar-multi-pager/cedar-multi-pager.component';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { HandlerContext } from '../util/handler-context';
import { InputType } from '../models/input-type.model';

@Injectable({
  providedIn: 'root',
})
export class ActiveComponentRegistryService {
  public modelToUI: Map<CedarComponent, CedarUIDirective> = new Map<CedarComponent, CedarUIDirective>();
  private modelToMultiPagerUI: Map<CedarComponent, CedarMultiPagerComponent> = new Map<
    CedarComponent,
    CedarMultiPagerComponent
  >();

  private getUIComponent(component: CedarComponent): CedarUIDirective {
    return this.modelToUI.get(component);
  }

  private getMultiPagerUI(component: CedarComponent): CedarMultiPagerComponent {
    return this.modelToMultiPagerUI.get(component);
  }

  setVisibility(component: CedarComponent, handlerContext): void {
    const fieldComponents = this.getFieldComponents(component);
    for (const fieldComponent of fieldComponents) {
      const dataObject = handlerContext.getDataObjectNodeByPath(fieldComponent.path);
      if (dataObject != null) {
        if (Object.hasOwn(dataObject, JsonSchema.atValue)) {
          if (dataObject[JsonSchema.atValue] === '' || dataObject[JsonSchema.atValue] === null) {
            fieldComponent.hidden = true;
          } else {
            fieldComponent.hidden = false;
          }
        } else if (
          Object.hasOwn(dataObject, JsonSchema.atId) &&
          fieldComponent.basicInfo.inputType === InputType.link
        ) {
          // url field single
          if (dataObject[JsonSchema.atId] != '' || dataObject[JsonSchema.atId] != null) {
            fieldComponent.hidden = false;
          } else {
            fieldComponent.hidden = true;
          }
        } else if (Object.hasOwn(dataObject, JsonSchema.atId)) {
          // controlled field single
          if (dataObject[JsonSchema.rdfsLabel] != '' || dataObject[JsonSchema.rdfsLabel] != null) {
            fieldComponent.hidden = false;
          } else {
            fieldComponent.hidden = true;
          }
        }
      }
    }
  }
  getFieldComponents(component): SingleFieldComponent[] {
    const fieldComponents = [] as SingleFieldComponent[];
    if (component instanceof MultiElementComponent) {
      for (const child of component.children) {
        if (child instanceof SingleFieldComponent) {
          fieldComponents.push(child);
        }
      }
    }
    return fieldComponents;
  }
  updateViewToModel(component: CedarComponent, handlerContext: HandlerContext): void {
    if (component instanceof SingleFieldComponent) {
      const dataObject: object = handlerContext.getDataObjectNodeByPath(component.path);
      const uiComponent: CedarUIDirective = this.getUIComponent(component);
      if (uiComponent != null && dataObject != null) {
        if (Object.hasOwn(dataObject, JsonSchema.atValue)) {
          uiComponent.setCurrentValue(dataObject[JsonSchema.atValue]);
        } else if (Object.hasOwn(dataObject, JsonSchema.atId) && component.basicInfo.inputType === InputType.link) {
          // url field single
          uiComponent.setCurrentValue(dataObject[JsonSchema.atId]);
        } else if (Object.hasOwn(dataObject, JsonSchema.atId)) {
          // controlled field single
          if (handlerContext.readOnlyMode) {
            const valueObject = {};
            valueObject[JsonSchema.rdfsLabel] = dataObject[JsonSchema.rdfsLabel];
            valueObject[JsonSchema.atId] = dataObject[JsonSchema.atId];
            uiComponent.setCurrentValue(valueObject);
          } else {
            uiComponent.setCurrentValue(dataObject[JsonSchema.rdfsLabel]);
          }
        }
      }
    } else if (component instanceof MultiFieldComponent) {
      const dataObject: object = handlerContext.getDataObjectNodeByPath(component.path);
      const parentDataObject = handlerContext.getParentDataObjectNodeByPath(component.path);
      const uiComponent: CedarUIDirective = this.getUIComponent(component);
      const multiInstanceInfo: MultiInstanceObjectInfo =
        handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(component);

      // this is a multi-value but not multipage component, such as checkbox or multiselect
      if (!component.isMultiPage()) {
        const dataArr = dataObject as Array<object>;

        if (uiComponent) {
          uiComponent.setCurrentValue(dataArr.map((a) => a[JsonSchema.atValue]));
        }
      } else if (dataObject != null) {
        if (dataObject[multiInstanceInfo.currentIndex] != null) {
          if (component.basicInfo.inputType === InputType.attributeValue) {
            let key = dataObject[multiInstanceInfo.currentIndex];

            if (key instanceof Object && Object.hasOwn(key, JsonSchema.atValue) && key[JsonSchema.atValue] === null) {
              handlerContext.changeAttributeValue(component, null, null);
            } else if (multiInstanceInfo.currentIndex > 0) {
              const cloneSourceKey = dataObject[multiInstanceInfo.currentIndex - 1];

              if (key === cloneSourceKey) {
                const val = parentDataObject[cloneSourceKey][JsonSchema.atValue];
                handlerContext.changeAttributeValue(component, null, val);
              }
            } else if (typeof key === 'string' && key === '') {
              // if it is an empty string, we silently accept it
              return;
            }
            // This next line is actually needed, current index can change
            key = dataObject[multiInstanceInfo.currentIndex];
            const value = parentDataObject[key][JsonSchema.atValue];
            const obj = {};
            obj[key] = value;

            if (uiComponent) {
              uiComponent.setCurrentValue(obj);
            }
          } else {
            if (Object.hasOwn(dataObject[multiInstanceInfo.currentIndex], JsonSchema.atValue)) {
              if (uiComponent) {
                uiComponent.setCurrentValue(dataObject[multiInstanceInfo.currentIndex][JsonSchema.atValue]);
              }
            } else if (
              Object.hasOwn(dataObject[multiInstanceInfo.currentIndex], JsonSchema.atId) &&
              component.basicInfo.inputType === InputType.link
            ) {
              // url field single
              if (uiComponent) {
                uiComponent.setCurrentValue(dataObject[multiInstanceInfo.currentIndex][JsonSchema.atId]);
              }
            } else if (
              Object.keys(dataObject[multiInstanceInfo.currentIndex]).length === 0 ||
              Object.hasOwn(dataObject[multiInstanceInfo.currentIndex], JsonSchema.atId)
            ) {
              // controlled field multipage
              if (uiComponent) {
                uiComponent.setCurrentValue(dataObject[multiInstanceInfo.currentIndex][JsonSchema.rdfsLabel]);
              }
            }
          }
        }

        if (component.isMultiPage()) {
          const uiPager = this.getMultiPagerUI(component);

          if (uiPager) {
            uiPager.updatePagingUI();
          }
        }
      } else {
        // Empty multi-field
        const uiPager = this.getMultiPagerUI(component);
        if (uiPager) {
          uiPager.updatePagingUI();
        }
      }
    } else if (component instanceof SingleElementComponent) {
      for (const childComponent of component.children) {
        this.updateViewToModel(childComponent, handlerContext);
      }
    } else if (component instanceof MultiElementComponent) {
      const uiPager = this.getMultiPagerUI(component);

      if (uiPager) {
        uiPager.updatePagingUI();
      }

      for (const childComponent of component.children) {
        this.updateViewToModel(childComponent, handlerContext);
      }
    }
  }

  deleteCurrentValue(component: CedarComponent): void {
    const uiComponent: CedarUIDirective = this.getUIComponent(component);

    if (uiComponent) {
      uiComponent.deleteCurrentValue();
    }
  }

  registerComponent(modelComponent: CedarComponent, uiComponent: CedarUIDirective): void {
    this.modelToUI.set(modelComponent, uiComponent);
  }

  registerMultiPagerComponent(modelComponent: CedarComponent, uiComponent: CedarMultiPagerComponent): void {
    this.modelToMultiPagerUI.set(modelComponent, uiComponent);
  }
}
