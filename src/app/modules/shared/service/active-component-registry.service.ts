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
import { isAuthorityTerm } from '../models/authority/authority-term.guard';
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
   * also takes both: its widget displays the label but retains the IRI for the
   * selected-term link and for paging safely between different terms.
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
    if (
      inputType === InputType.controlled ||
      EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType as InputType) ||
      readOnlyMode
    ) {
      // `?? ''` on both: the widget wants a term, and a node that carries an IRI
      // without a label — or a label the reader could not find — is still the
      // term the field holds. The reads above answer null for either.
      return { iri: iri ?? '', label: label ?? '' };
    }
    return label;
  }

  /**
   * Whether the value about to be shown is a declared default that should be cleared instead.
   *
   * Reading a template, CEE seeds the empty instance from the template's defaults, so a list arrives
   * pre-selected and a term field pre-filled. A control holding a value shows no placeholder, and the
   * placeholder is where the specification lives — so the default hid the very thing that would have
   * explained it. Cleared here, the box states `default Green` along with the count and the permitted
   * values, and nothing on screen claims somebody chose it.
   *
   * The value has to be compared, not just the mode. This method runs on every model-to-view sync,
   * so testing the mode alone cleared whatever the control held: a term a host pushed into a
   * read-only form with no instance behind it was blanked on arrival, which `view-sync.spec.ts`
   * caught. Only a value equal to what the template declares is a default; anything else was
   * recorded by somebody and belongs on screen.
   *
   * And only where a placeholder exists to state it in. A radio or checkbox group has none, so there
   * the default stays visible in the control, marked as the default among the options.
   */
  private static shouldClearDeclaredDefault(
    component: SingleFieldComponent,
    handlerContext: HandlerContext,
    node: InstanceNode,
  ): boolean {
    if (!handlerContext.statesSpecification) {
      return false;
    }
    const inputType = component.basicInfo.inputType;
    if (inputType === InputType.radio || inputType === InputType.checkbox) {
      return false;
    }
    return ActiveComponentRegistryService.holdsDeclaredDefault(component, node);
  }

  /** Whether the node carries exactly the value the template declares as this field's default. */
  private static holdsDeclaredDefault(component: SingleFieldComponent, node: InstanceNode): boolean {
    const declared = component.valueInfo.defaultValue;
    if (declared === null) {
      // An enumeration declares its default by marking an option rather than by naming a value.
      const chosen = component.choiceInfo?.choices?.find((option) => option.selectedByDefault);
      return chosen !== undefined && InstanceValueNode.literal(node) === chosen.label;
    }
    if (isAuthorityTerm(declared)) {
      return InstanceValueNode.iri(node) === declared.iri;
    }
    return InstanceValueNode.literal(node) === String(declared);
  }

  updateViewToModel(component: CedarComponent, handlerContext: HandlerContext): void {
    if (component instanceof SingleFieldComponent) {
      const dataObject: InstanceNode | null = handlerContext.getDataObjectNodeByPath(component.path);
      const uiComponent: CedarUIDirective | null = this.getUIComponent(component);
      if (uiComponent != null && dataObject == null) {
        // The same widget is reused while a multi element pages between
        // occurrences. A child that is absent from the new occurrence must
        // actively clear that widget, or the preceding occurrence remains on
        // screen even though it is not present in the model.
        uiComponent.setCurrentValue(null);
      } else if (uiComponent != null && dataObject != null) {
        const clearDefault = ActiveComponentRegistryService.shouldClearDeclaredDefault(
          component,
          handlerContext,
          dataObject,
        );
        if (InstanceValueNode.isLiteral(dataObject)) {
          uiComponent.setCurrentValue(clearDefault ? null : InstanceValueNode.literal(dataObject));
        } else if (InstanceValueNode.isIriBearing(dataObject)) {
          uiComponent.setCurrentValue(
            clearDefault
              ? null
              : ActiveComponentRegistryService.iriValueForWidget(dataObject, component, handlerContext.readOnlyMode),
          );
        } else {
          uiComponent.setCurrentValue(null);
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

        if (uiComponent) {
          uiComponent.setCurrentValue(dataArr?.map((a) => InstanceValueNode.literal(a)) ?? []);
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
              /*
               * A page holding nothing falls through to the clear below, which is
               * where it always went. There was a branch here for it, testing
               * `Object.keys(pageNode).length === 0` — and a node is one of the
               * model library's classes, whose own enumerable properties are never
               * none, while an unfilled IRI-valued slot is an atom rather than a
               * container. So the test could not hold either way, and the widget
               * was cleared with `undefined` instead of `null` by a line that
               * never ran.
               */
            } else if (uiComponent) {
              uiComponent.setCurrentValue(null);
            }
          }
        } else if (uiComponent && component.basicInfo.inputType !== InputType.attributeValue) {
          uiComponent.setCurrentValue(null);
        }

        if (component.isMultiPage()) {
          const uiPager = this.getMultiPagerUI(component);

          if (uiPager) {
            uiPager.updatePagingUI();
          }
        }
      } else {
        // Empty multi-field
        if (uiComponent && component.basicInfo.inputType !== InputType.attributeValue) {
          uiComponent.setCurrentValue(component.isMultiPage() ? null : []);
        }
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
