import type { CedarUIDirective } from '../models/ui/cedar-ui-component.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { JsonSchema } from 'cedar-model-typescript-library';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { Injectable } from '@angular/core';
import type { CedarMultiPagerComponent } from '../components/cedar-multi-pager/cedar-multi-pager.component';
import { MultiInstanceObjectInfo } from '../models/info/multi-instance-object-info.model';
import { HandlerContext } from '../util/handler-context';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { InstanceValueNode } from '../util/instance-value-node';

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
      if (dataObject == null) {
        continue;
      }
      // A field the template hid stays hidden whatever it holds. This pass
      // writes the same flag for a different reason — the field is empty and
      // the viewer is configured not to show empty fields — and without the
      // guard a template-hidden field carrying a value would be revealed by it.
      if (fieldComponent.hiddenInTemplate) {
        fieldComponent.hidden = true;
      } else if (InstanceValueNode.isLiteral(dataObject)) {
        const value = InstanceValueNode.literal(dataObject);
        fieldComponent.hidden = value === '' || value === null;
      } else if (InstanceValueNode.isIriBearing(dataObject)) {
        // CHARACTERISED, NOT INTENDED. The original asked
        // `value != '' || value != null`, which is true of every value there
        // is — nothing equals both — so an IRI-valued field was never hidden
        // however empty it was, and the `else` that would have hidden it was
        // unreachable. Kept because it loses no data, only leaves a blank row
        // in the read-only viewer, and because "links always show" is a
        // defensible thing to have decided on purpose. See view-sync.spec.ts.
        fieldComponent.hidden = false;
      }
    }
  }

  /**
   * What an IRI-valued node should look like to the widget showing it.
   *
   * The node supplies the IRI and, if it has one, the label; the field's own
   * type decides which the widget wants. A link takes the IRI, because that is
   * its value. An external authority field takes both — the IRI identifies the
   * record, the label is what its autocomplete displays. A controlled term
   * takes the label alone while it is editable, since the autocomplete's own
   * value is the label, and both once read-only, where there is no
   * autocomplete and the viewer wants the IRI to link to.
   */
  private static iriValueForWidget(node: object, component: CedarComponent, readOnlyMode: boolean): unknown {
    const inputType = (component as SingleFieldComponent).basicInfo.inputType;
    const iri = InstanceValueNode.iri(node);

    if (inputType === InputType.link) {
      return iri;
    }
    const label = InstanceValueNode.label(node);
    if (EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType) || readOnlyMode) {
      const valueObject = {};
      valueObject[JsonSchema.rdfsLabel] = label;
      valueObject[JsonSchema.atId] = iri;
      return valueObject;
    }
    return label;
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
        if (InstanceValueNode.isLiteral(dataObject)) {
          uiComponent.setCurrentValue(InstanceValueNode.literal(dataObject));
        } else if (InstanceValueNode.isIriBearing(dataObject)) {
          uiComponent.setCurrentValue(
            ActiveComponentRegistryService.iriValueForWidget(dataObject, component, handlerContext.readOnlyMode),
          );
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

        if (uiComponent && dataArr) {
          uiComponent.setCurrentValue(dataArr.map((a) => InstanceValueNode.literal(a)));
        }
      } else if (dataObject != null) {
        if (dataObject[multiInstanceInfo.currentIndex] != null) {
          if (component.basicInfo.inputType === InputType.attributeValue) {
            let key = dataObject[multiInstanceInfo.currentIndex];

            if (key instanceof Object && InstanceValueNode.literal(key) === null) {
              handlerContext.changeAttributeValue(component, null, null);
            } else if (multiInstanceInfo.currentIndex > 0) {
              const cloneSourceKey = dataObject[multiInstanceInfo.currentIndex - 1];

              if (key === cloneSourceKey) {
                const val = InstanceValueNode.literal(parentDataObject[cloneSourceKey]) as string;
                handlerContext.changeAttributeValue(component, null, val);
              }
            } else if (typeof key === 'string' && key === '') {
              // if it is an empty string, we silently accept it
              return;
            }
            // This next line is actually needed, current index can change
            key = dataObject[multiInstanceInfo.currentIndex];
            const value = InstanceValueNode.literal(parentDataObject[key]);
            const obj = {};
            obj[key] = value;

            if (uiComponent) {
              uiComponent.setCurrentValue(obj);
            }
          } else {
            const pageNode = dataObject[multiInstanceInfo.currentIndex];
            if (InstanceValueNode.isLiteral(pageNode)) {
              if (uiComponent) {
                uiComponent.setCurrentValue(InstanceValueNode.literal(pageNode));
              }
            } else if (InstanceValueNode.isIriBearing(pageNode)) {
              if (uiComponent) {
                uiComponent.setCurrentValue(
                  ActiveComponentRegistryService.iriValueForWidget(pageNode, component, handlerContext.readOnlyMode),
                );
              }
            } else if (Object.keys(pageNode).length === 0) {
              // A page with nothing on it at all. The controlled-term widget is
              // still told, so it clears rather than keeping the previous
              // page's term on screen.
              if (uiComponent) {
                uiComponent.setCurrentValue(undefined);
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
    // Angular can reuse a component instance while changing its input. Remove
    // that UI's previous model binding before recording the new one.
    for (const [registeredModel, registeredUI] of this.modelToUI) {
      if (registeredUI === uiComponent && registeredModel !== modelComponent) {
        this.modelToUI.delete(registeredModel);
      }
    }
    this.modelToUI.set(modelComponent, uiComponent);
  }

  unregisterComponent(modelComponent: CedarComponent, uiComponent: CedarUIDirective): void {
    // A replacement UI may already have registered for the same model by the
    // time Angular destroys the old one. Never let that late destroy remove
    // the replacement's binding.
    if (this.modelToUI.get(modelComponent) === uiComponent) {
      this.modelToUI.delete(modelComponent);
    }
  }

  registerMultiPagerComponent(modelComponent: CedarComponent, uiComponent: CedarMultiPagerComponent): void {
    for (const [registeredModel, registeredUI] of this.modelToMultiPagerUI) {
      if (registeredUI === uiComponent && registeredModel !== modelComponent) {
        this.modelToMultiPagerUI.delete(registeredModel);
      }
    }
    this.modelToMultiPagerUI.set(modelComponent, uiComponent);
  }

  unregisterMultiPagerComponent(modelComponent: CedarComponent, uiComponent: CedarMultiPagerComponent): void {
    if (this.modelToMultiPagerUI.get(modelComponent) === uiComponent) {
      this.modelToMultiPagerUI.delete(modelComponent);
    }
  }

  clear(): void {
    this.modelToUI.clear();
    this.modelToMultiPagerUI.clear();
  }
}
