import type { CedarUIDirective } from '../models/ui/cedar-ui-component.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
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
import { InstanceDataAttributeValueFieldName } from 'cedar-model-typescript-library';

/** The name an attribute-value slot carries, or null when the slot holds something else. */
const attributeNameOf = (node: InstanceNode | undefined): string | null =>
  node instanceof InstanceDataAttributeValueFieldName ? node.name : null;
import { AuthorityTerm } from '../models/authority/authority-search-response.model';
import { InstanceNode, isInstanceArray, isInstanceObject } from '../models/instance-node.model';

@Injectable({
  providedIn: 'root',
})
export class ActiveComponentRegistryService {
  public modelToUI: Map<CedarComponent, CedarUIDirective> = new Map<CedarComponent, CedarUIDirective>();
  private modelToMultiPagerUI: Map<CedarComponent, CedarMultiPagerComponent> = new Map<
    CedarComponent,
    CedarMultiPagerComponent
  >();

  /*
   * `?? null` on both. `Map.get` returns `undefined` for a component that has no
   * live widget, which is the normal state for anything off the current page — and
   * every caller already tests the result against null.
   */
  private getUIComponent(component: CedarComponent): CedarUIDirective | null {
    return this.modelToUI.get(component) ?? null;
  }

  private getMultiPagerUI(component: CedarComponent): CedarMultiPagerComponent | null {
    return this.modelToMultiPagerUI.get(component) ?? null;
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
  private static iriValueForWidget(
    node: InstanceNode,
    component: CedarComponent,
    readOnlyMode: boolean,
  ): string | AuthorityTerm | null {
    // `?? ''` so a field with no declared input type falls through the two tests
    // below to the label, which is what it did when the type was `any`.
    const inputType = (component as SingleFieldComponent).basicInfo.inputType ?? '';
    const iri = InstanceValueNode.iri(node) ?? null;

    if (inputType === InputType.link) {
      return iri;
    }
    const label = InstanceValueNode.label(node) ?? null;
    if (EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType as InputType) || readOnlyMode) {
      // `?? ''` on both: the widget wants a term, and a node that carries an IRI
      // without a label — or a label the reader could not find — is still the
      // term the field holds. The reads above answer null for either.
      return { iri: iri ?? '', label: label ?? '' };
    }
    return label;
  }

  updateViewToModel(component: CedarComponent, handlerContext: HandlerContext): void {
    if (component instanceof SingleFieldComponent) {
      const dataObject: InstanceNode | null = handlerContext.getDataObjectNodeByPath(component.path);
      const uiComponent: CedarUIDirective | null = this.getUIComponent(component);
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
      const dataObject: InstanceNode | null = handlerContext.getDataObjectNodeByPath(component.path);
      const parentDataObject = handlerContext.getParentDataObjectNodeByPath(component.path);
      const uiComponent: CedarUIDirective | null = this.getUIComponent(component);
      const multiInstanceInfo: MultiInstanceObjectInfo | null =
        handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(component);

      // this is a multi-value but not multipage component, such as checkbox or multiselect
      if (!component.isMultiPage()) {
        const dataArr = isInstanceArray(dataObject) ? dataObject : null;

        if (uiComponent && dataArr) {
          uiComponent.setCurrentValue(dataArr.map((a) => InstanceValueNode.literal(a)));
        }
      } else if (isInstanceArray(dataObject) && multiInstanceInfo !== null) {
        // A paged multi field with no node in the info tree has no cursor, so there
        // is no occurrence to push back into the widget.
        if (dataObject[multiInstanceInfo.currentIndex] != null) {
          if (component.basicInfo.inputType === InputType.attributeValue) {
            let keyName = attributeNameOf(dataObject[multiInstanceInfo.currentIndex]);

            if (keyName === null && InstanceValueNode.literal(dataObject[multiInstanceInfo.currentIndex]) === null) {
              handlerContext.changeAttributeValue(component, null, null);
            } else if (keyName === '') {
              // if it is an empty string, we silently accept it
              return;
            }
            // This next line is actually needed, current index can change
            keyName = attributeNameOf(dataObject[multiInstanceInfo.currentIndex]);
            if (keyName === null || !isInstanceObject(parentDataObject)) {
              return;
            }
            const value = InstanceValueNode.literal(parentDataObject.values[keyName]);
            // A widget model, not a node: the name/value pair the attribute
            // widget's two boxes are driven from.
            const obj: Record<string, string | null> = { [keyName]: value ?? null };

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
            } else if (isInstanceObject(pageNode) && Object.keys(pageNode).length === 0) {
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
    const uiComponent: CedarUIDirective | null = this.getUIComponent(component);

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
