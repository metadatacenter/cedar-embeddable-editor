import { TemplateComponent } from '../models/template/template-component.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { ElementComponent } from '../models/component/element-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { InstanceDataContainer, TemplateInstance, TemplateInstanceBuilder } from 'cedar-model-typescript-library';
import * as _ from 'lodash-es';
import { DataObjectUtil } from '../util/data-object-util';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { InstanceArray, InstanceNode, InstanceObject } from '../models/instance-node.model';

/**
 * Builds an empty instance from a template.
 *
 * Stateless. It held five fields, and four of them were never read: `dataObject`
 * was assigned nowhere, `templateJsonObj` and `multiInstanceObjectService` were
 * assigned and read nowhere — the second through an `injectMultiInstanceService`
 * call that therefore did nothing — and `dataObjectFull` was a local that a
 * single method wrote and returned. Only the template was genuinely threaded, and
 * it is now a parameter, which is what threading a value through two calls means.
 */
export class DataObjectBuilderHandler {
  /*
   * A container, because that is all the builder ever writes into: every line
   * below puts a named child on it.
   */
  public buildRecursively(
    component: CedarComponent,
    dataObject: InstanceObject,
    buildingMode: DataObjectBuildingMode,
  ): void {
    if (
      component instanceof SingleElementComponent ||
      component instanceof MultiElementComponent ||
      component instanceof CedarTemplate
    ) {
      const iterableComponent: ElementComponent = component as ElementComponent;
      const targetName = iterableComponent.name;

      if (component instanceof MultiElementComponent) {
        // MultiElement
        const multiElement: MultiElementComponent = component as MultiElementComponent;
        const occurrences: InstanceArray = [];
        dataObject.setValue(targetName, occurrences as unknown as InstanceNode);
        if (multiElement.multiInfo.getSafeMinItems() > 0) {
          const dummyTargetObject = new InstanceDataContainer();
          DataObjectBuilderHandler.addPropertyIris(component, dummyTargetObject, buildingMode);
          for (const childComponent of iterableComponent.children) {
            this.buildRecursively(childComponent, dummyTargetObject, buildingMode);
          }
          for (let idx = 0; idx < multiElement.multiInfo.getSafeMinItems(); idx++) {
            occurrences.push(_.cloneDeep(dummyTargetObject));
          }
        }
      } else {
        // Single Element || Template
        const occurrence = new InstanceDataContainer();
        dataObject.setValue(targetName, occurrence);
        DataObjectBuilderHandler.addPropertyIris(component, occurrence, buildingMode);
        for (const childComponent of iterableComponent.children) {
          this.buildRecursively(childComponent, occurrence, buildingMode);
        }
      }
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const targetName = nonIterableComponent.name;
      if (component instanceof MultiFieldComponent) {
        // MultiFieldComponent
        const multiField: MultiFieldComponent = component as MultiFieldComponent;
        let occurrences: InstanceArray = [];
        dataObject.setValue(targetName, occurrences as unknown as InstanceNode);
        if (multiField.multiInfo.getSafeMinItems() > 0) {
          if (component?.choiceInfo?.choices?.length > 0) {
            // A choice field starts holding whatever is selected by default.
            // That used to *replace* the `minItems` skeleton outright, so a
            // field with no default selection came out as `[]` against a schema
            // demanding at least one item — invalid the moment it was built,
            // and not something the user could correct, since the count is not
            // theirs to change. Pad instead of replace.
            const values = [];
            for (const choice of component.choiceInfo.choices) {
              if (choice.selectedByDefault) {
                values.push(choice.label);
              }
            }
            occurrences = DataObjectUtil.getMultiValueWrapper(nonIterableComponent, buildingMode, values);
            dataObject.setValue(targetName, occurrences as unknown as InstanceNode);
          }
          for (let idx = occurrences.length; idx < multiField.multiInfo.getSafeMinItems(); idx++) {
            occurrences.push(DataObjectUtil.getEmptyValueWrapper(nonIterableComponent, buildingMode));
          }
        }
      } else {
        // SingleFieldComponent
        dataObject.setValue(targetName, DataObjectUtil.getEmptyValueWrapper(nonIterableComponent, buildingMode));
        if (component?.choiceInfo?.choices?.length > 0) {
          let value: string | null = null;
          for (const choice of component.choiceInfo.choices) {
            if (choice.selectedByDefault) {
              value = choice.label;
            }
          }
          dataObject.setValue(
            targetName,
            DataObjectUtil.getSingleValueWrapper(nonIterableComponent, buildingMode, value ?? ''),
          );
        }
      }
    }
  }

  public static setCurrentCountToMinRecursively(component: CedarComponent, path: string[]): void {
    if (path.length === 0) {
      return;
    }
    // const firstPath = path[0];
    const remainingPath = path.slice(1);
    if (component instanceof SingleElementComponent) {
      const singleElement: SingleElementComponent = component as SingleElementComponent;
      for (const childComponent of singleElement.children) {
        DataObjectBuilderHandler.setCurrentCountToMinRecursively(childComponent, remainingPath);
      }
    } else if (component instanceof MultiElementComponent) {
      const multiElement: MultiElementComponent = component as MultiElementComponent;
      const min = multiElement.multiInfo.getSafeMinItems();
      if (min === 0) {
        multiElement.multiInfo.minItems = 1;
      }
      for (const childComponent of multiElement.children) {
        DataObjectBuilderHandler.setCurrentCountToMinRecursively(childComponent, remainingPath);
      }
    } else if (component instanceof MultiFieldComponent) {
      const multiField: MultiFieldComponent = component as MultiFieldComponent;
      const min = multiField.multiInfo.getSafeMinItems();
      if (min === 0) {
        multiField.multiInfo.minItems = 1;
      }
    }
  }

  /**
   * Record the property IRI of each of this container's children.
   *
   * These are what a CEDAR instance's `@context` block is made of, and the
   * container carries them: `iris` on `InstanceDataContainer`, which the writer
   * turns into the block when it emits a document. This used to write the block
   * itself, here, into a tree that was the document.
   *
   * The entries come off the component, where the template parser put them.
   */
  public static addPropertyIris(
    component: CedarComponent,
    dataObject: InstanceObject,
    buildingMode: DataObjectBuildingMode,
  ): void {
    if (buildingMode !== DataObjectBuildingMode.INCLUDE_CONTEXT) {
      return;
    }
    const container = component as unknown as AbstractElementComponent;
    if (container?.contextEntries == null) {
      return;
    }
    Object.entries(container.contextEntries).forEach(([key, iri]) => {
      if (typeof iri === 'string') {
        dataObject.setIri(key, iri);
      }
    });
  }

  /**
   * A new instance of this template, holding nothing.
   *
   * The envelope is not written here any more. `schema:isBasedOn`, the name, the
   * description and the four provenance fields are properties of a
   * `TemplateInstance`, and the writer emits them — `addEnvelope` filled them in
   * by hand, and had to know all nine keys to do it.
   */
  buildNewFullDataObject(templateRepresentation: TemplateComponent): TemplateInstance {
    const template = templateRepresentation as CedarTemplate;
    const builder = new TemplateInstanceBuilder();
    if (template?.isBasedOn) {
      builder.withSchemaIsBasedOn(template.isBasedOn);
    }
    // The convention in every corpus instance: the template's name followed by
    // "metadata", and an empty description. `schema:name` is declared with a
    // `minLength` of 1, so an instance with none does not validate against the
    // template it came from.
    const templateName = template?.labelInfo?.label;
    builder.withSchemaName(templateName ? `${templateName} metadata` : 'metadata');
    builder.withSchemaDescription('');
    const instance = builder.build();
    this.buildNewByIterating(templateRepresentation, instance.dataContainer, DataObjectBuildingMode.INCLUDE_CONTEXT);
    return instance;
  }

  private buildNewByIterating(
    templateRepresentation: TemplateComponent,
    dataObject: InstanceObject,
    buildingMode: DataObjectBuildingMode,
  ): void {
    if (templateRepresentation == null || templateRepresentation.children == null) {
      return;
    }
    DataObjectBuilderHandler.addPropertyIris(templateRepresentation, dataObject, buildingMode);
    for (const childComponent of templateRepresentation.children) {
      this.buildRecursively(childComponent, dataObject, buildingMode);
    }
  }
}
