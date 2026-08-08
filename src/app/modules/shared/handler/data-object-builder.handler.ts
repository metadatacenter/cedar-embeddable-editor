import { TemplateComponent } from '../models/template/template-component.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { ElementComponent } from '../models/component/element-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { JsonSchema } from 'cedar-model-typescript-library';
import * as _ from 'lodash-es';
import { DataObjectUtil } from '../util/data-object-util';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { DEFAULT_IRI_PREFIX } from '../util/iri-prefix';
import { InstanceNode, InstanceObject, isInstanceArray, isInstanceObject } from '../models/instance-node.model';

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
  constructor(private readonly iriPrefix: () => string = () => DEFAULT_IRI_PREFIX) {}

  /*
   * `InstanceObject`, not `InstanceExtractData`. The builder only ever writes named
   * children into a container — every line below is `dataObject[targetName] = …` —
   * so a node that could be a leaf or a list was never what this accepts.
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
        dataObject[targetName] = DataObjectUtil.getEmptyList();
        if (multiElement.multiInfo.getSafeMinItems() > 0) {
          const dummyTargetObject: InstanceObject = DataObjectUtil.getEmptyObject();
          DataObjectBuilderHandler.addContext(component, dummyTargetObject, buildingMode);
          for (const childComponent of iterableComponent.children) {
            this.buildRecursively(childComponent, dummyTargetObject, buildingMode);
          }
          for (let idx = 0; idx < multiElement.multiInfo.getSafeMinItems(); idx++) {
            const clone = _.cloneDeep(dummyTargetObject);
            dataObject[targetName].push(clone);
          }
        }
        // Only the full tree. An element occurrence needs an `@id` in the
        // artifact — CEDAR requires one — but the extract tree is the same
        // content with the envelope left off at every depth, and `@id` is
        // envelope. Minting it into both meant a freshly built extract carried
        // element @ids and one read back from an instance did not, so every
        // consumer of the extract saw a different shape depending on how the
        // user arrived at it.
        if (component instanceof MultiElementComponent && buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
          dataObject[targetName].forEach((child) => {
            this.addRandomAtId(child);
          });
        }
      } else {
        // Single Element || Template
        dataObject[targetName] = DataObjectUtil.getEmptyObject();
        DataObjectBuilderHandler.addContext(component, dataObject[targetName], buildingMode);
        for (const childComponent of iterableComponent.children) {
          this.buildRecursively(childComponent, dataObject[targetName], buildingMode);
        }
        if (component instanceof SingleElementComponent && buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
          this.addRandomAtId(dataObject[targetName]);
        }
      }
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const targetName = nonIterableComponent.name;
      if (component instanceof MultiFieldComponent) {
        // MultiFieldComponent
        const multiField: MultiFieldComponent = component as MultiFieldComponent;
        dataObject[targetName] = DataObjectUtil.getEmptyList();
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
            dataObject[targetName] = DataObjectUtil.getMultiValueWrapper(nonIterableComponent, buildingMode, values);
          }
          // Through a typed local rather than re-indexing `dataObject[targetName]`
          // three times: the index cannot know the child is a list, and the whole
          // point of the branch is that it is one.
          const occurrences = dataObject[targetName];
          if (isInstanceArray(occurrences)) {
            for (let idx = occurrences.length; idx < multiField.multiInfo.getSafeMinItems(); idx++) {
              occurrences.push(DataObjectUtil.getEmptyValueWrapper(nonIterableComponent, buildingMode));
            }
          }
        }
      } else {
        // SingleFieldComponent
        dataObject[targetName] = DataObjectUtil.getEmptyValueWrapper(nonIterableComponent, buildingMode);
        if (component?.choiceInfo?.choices?.length > 0) {
          let value: string | null = null;
          for (const choice of component.choiceInfo.choices) {
            if (choice.selectedByDefault) {
              value = choice.label;
            }
          }
          dataObject[targetName] = DataObjectUtil.getSingleValueWrapper(
            nonIterableComponent,
            buildingMode,
            value ?? '',
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
   * Give this container's instance its `@context`.
   *
   * The block comes off the component, where a parser put it. It used to be
   * read out of the raw template here, which is why the builder had to be
   * handed the template at every level.
   */
  public static addContext(
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
    dataObject[JsonSchema.atContext] = { ...container.contextEntries };
  }

  /**
   * Fill in the envelope every CEDAR instance carries.
   *
   * A template is a JSON Schema for its own instances, and its `required` list
   * names all nine envelope keys — `@context`, `@id`, `schema:isBasedOn`,
   * `schema:name`, `schema:description` and the four provenance fields. An
   * instance missing any of them does not validate against the template it came
   * from, which is the check `cedar-model-validation-library` performs.
   *
   * Which of them CEE can fill in differs. `@id` and the provenance fields are
   * assigned when the instance is saved and their schemas are
   * `["string", "null"]`, so leaving them null is correct and the library's
   * writer emits them. `schema:name` is `string` with `minLength: 1` and
   * `schema:description` is `string`, so null fails both — the convention in
   * every corpus instance is the template's name followed by "metadata", and an
   * empty description.
   *
   * Only on the copy that carries the envelope; the extract copy CEE works
   * against has none of this, and `DataObjectUtil.deleteContext` strips it.
   */
  public static addEnvelope(
    templateRepresentation: TemplateComponent,
    dataObject: InstanceObject,
    buildingMode: DataObjectBuildingMode,
  ): void {
    if (buildingMode !== DataObjectBuildingMode.INCLUDE_CONTEXT || dataObject == null) {
      return;
    }
    const template = templateRepresentation as CedarTemplate;

    if (template?.isBasedOn) {
      dataObject[JsonSchema.schemaIsBasedOn] = template.isBasedOn;
    }
    if (dataObject[JsonSchema.schemaName] == null) {
      const templateName = template?.labelInfo?.label;
      dataObject[JsonSchema.schemaName] = templateName ? `${templateName} metadata` : 'metadata';
    }
    if (dataObject[JsonSchema.schemaDescription] == null) {
      dataObject[JsonSchema.schemaDescription] = '';
    }
  }

  public addRandomAtId(dataObject: InstanceNode): void {
    if (!isInstanceObject(dataObject)) {
      return;
    }
    if (!Object.hasOwn(dataObject, JsonSchema.atId)) {
      const iri = this.getTemplateElementInstanceIRIPrefix() + DataObjectUtil.generateGUID();
      dataObject[JsonSchema.atId] = iri;
    }
  }

  public getTemplateElementInstanceIRIPrefix(): string {
    return this.iriPrefix() + 'template-element-instances/';
  }

  buildNewFullDataObject(templateRepresentation: TemplateComponent): InstanceObject {
    // `InstanceFullData` is a type alias now, not a class: an empty instance root
    // is an empty object, which is what `new` produced anyway.
    const dataObjectFull: InstanceObject = {};
    this.buildNewByIterating(templateRepresentation, dataObjectFull, DataObjectBuildingMode.INCLUDE_CONTEXT);
    return dataObjectFull;
  }

  private buildNewByIterating(
    templateRepresentation: TemplateComponent,
    dataObject: InstanceObject,
    buildingMode: DataObjectBuildingMode,
  ): void {
    if (templateRepresentation == null || templateRepresentation.children == null) {
      return;
    }
    // The template's own `@context` sits on the instance root, and so does the
    // IRI of the template the instance is an instance of.
    DataObjectBuilderHandler.addContext(templateRepresentation, dataObject, buildingMode);
    DataObjectBuilderHandler.addEnvelope(templateRepresentation, dataObject, buildingMode);
    for (const childComponent of templateRepresentation.children) {
      this.buildRecursively(childComponent, dataObject, buildingMode);
    }
  }
}
