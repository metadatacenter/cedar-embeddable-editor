import { TemplateComponent } from '../models/template/template-component.model';
import { CedarComponent } from '../models/component/cedar-component.model';
import { SingleElementComponent } from '../models/element/single-element-component.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { ElementComponent } from '../models/component/element-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { JsonSchema } from '../models/json-schema.model';
import * as _ from 'lodash-es';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { InstanceFullData } from '../models/instance-full-data.model';
import { DataObjectUtil } from '../util/data-object-util';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';
import { CedarInputTemplate } from '../models/cedar-input-template.model';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';

export class DataObjectBuilderHandler {
  private dataObject: object;
  private dataObjectFull: object;
  private templateJsonObj: object;
  private templateRepresentation: TemplateComponent;
  private multiInstanceObjectService: MultiInstanceObjectHandler;

  public static buildRecursively(
    component: CedarComponent,
    dataObject: InstanceExtractData,
    buildingMode: DataObjectBuildingMode,
  ): void {
    let ret = null;

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
        if (multiElement.multiInfo.minItems > 0) {
          const dummyTargetObject: object = DataObjectUtil.getEmptyObject();
          DataObjectBuilderHandler.addContext(component, dummyTargetObject, buildingMode);
          for (const childComponent of iterableComponent.children) {
            DataObjectBuilderHandler.buildRecursively(childComponent, dummyTargetObject, buildingMode);
          }
          for (let idx = 0; idx < multiElement.multiInfo.minItems; idx++) {
            const clone = _.cloneDeep(dummyTargetObject as any);
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
            DataObjectBuilderHandler.addRandomAtId(child);
          });
        }
      } else {
        // Single Element || Template
        dataObject[targetName] = DataObjectUtil.getEmptyObject();
        DataObjectBuilderHandler.addContext(component, dataObject[targetName], buildingMode);
        for (const childComponent of iterableComponent.children) {
          DataObjectBuilderHandler.buildRecursively(childComponent, dataObject[targetName], buildingMode);
        }
        if (component instanceof SingleElementComponent && buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
          DataObjectBuilderHandler.addRandomAtId(dataObject[targetName]);
        }
      }

      ret = dataObject[targetName];
    }
    if (component instanceof SingleFieldComponent || component instanceof MultiFieldComponent) {
      const nonIterableComponent = component as FieldComponent;
      const targetName = nonIterableComponent.name;
      if (component instanceof MultiFieldComponent) {
        // MultiFieldComponent
        const multiField: MultiFieldComponent = component as MultiFieldComponent;
        dataObject[targetName] = DataObjectUtil.getEmptyList();
        if (multiField.multiInfo.minItems > 0) {
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
          for (let idx = dataObject[targetName].length; idx < multiField.multiInfo.minItems; idx++) {
            dataObject[targetName].push(DataObjectUtil.getEmptyValueWrapper(nonIterableComponent, buildingMode));
          }
        }
      } else {
        // SingleFieldComponent
        dataObject[targetName] = DataObjectUtil.getEmptyValueWrapper(nonIterableComponent, buildingMode);
        if (component?.choiceInfo?.choices?.length > 0) {
          let value = null;
          for (const choice of component.choiceInfo.choices) {
            if (choice.selectedByDefault) {
              value = choice.label;
            }
          }
          dataObject[targetName] = DataObjectUtil.getSingleValueWrapper(nonIterableComponent, buildingMode, value);
        }
      }
      ret = dataObject[targetName];
    }
    return ret;
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
    dataObject: InstanceExtractData,
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
    dataObject: InstanceExtractData,
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

  public static addRandomAtId(dataObject: InstanceExtractData): void {
    if (!Object.hasOwn(dataObject, JsonSchema.atId)) {
      const iri = DataObjectBuilderHandler.getTemplateElementInstanceIRIPrefix() + DataObjectUtil.generateGUID();
      dataObject[JsonSchema.atId] = iri;
    }
  }

  public static getTemplateElementInstanceIRIPrefix(): string {
    return DataObjectUtil.getIriPrefix() + 'template-element-instances/';
  }

  injectMultiInstanceService(multiInstanceObjectService: MultiInstanceObjectHandler): void {
    this.multiInstanceObjectService = multiInstanceObjectService;
  }

  buildNewFullDataObject(
    templateRepresentation: TemplateComponent,
    templateJsonObj: CedarInputTemplate,
  ): InstanceFullData {
    this.templateJsonObj = templateJsonObj;
    this.templateRepresentation = templateRepresentation;
    this.dataObjectFull = new InstanceFullData();
    this.buildNewByIterating(this.dataObjectFull, DataObjectBuildingMode.INCLUDE_CONTEXT);
    return this.dataObjectFull;
  }

  private buildNewByIterating(dataObject: InstanceExtractData, buildingMode: DataObjectBuildingMode): void {
    if (this.templateRepresentation == null || this.templateRepresentation.children == null) {
      return;
    }
    // The template's own `@context` sits on the instance root, and so does the
    // IRI of the template the instance is an instance of.
    DataObjectBuilderHandler.addContext(this.templateRepresentation, dataObject, buildingMode);
    DataObjectBuilderHandler.addEnvelope(this.templateRepresentation, dataObject, buildingMode);
    for (const childComponent of this.templateRepresentation.children) {
      DataObjectBuilderHandler.buildRecursively(childComponent, dataObject, buildingMode);
    }
  }
}
