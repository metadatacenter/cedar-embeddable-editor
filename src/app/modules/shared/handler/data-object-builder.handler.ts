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

export class DataObjectBuilderHandler {
  private dataObject: object;
  private dataObjectFull: object;
  private templateJsonObj: object;
  private templateRepresentation: TemplateComponent;
  private multiInstanceObjectService: MultiInstanceObjectHandler;

  static getSubTemplate(template: CedarInputTemplate, path: string[]): CedarInputTemplate {
    if (path.length === 0) {
      return template;
    }
    const firstPath = path[0];
    const remainingPath = path.slice(1);
    const subTemplate = DataObjectUtil.getSafeSubTemplate(template, firstPath);
    return this.getSubTemplate(subTemplate, remainingPath);
  }

  public static buildRecursively(
    component: CedarComponent,
    dataObject: InstanceExtractData,
    templateJsonObj: CedarInputTemplate,
    buildingMode: DataObjectBuildingMode,
  ): void {
    let ret = null;
    if (templateJsonObj != null) {
      DataObjectBuilderHandler.addContext(component, dataObject, templateJsonObj, buildingMode);
      // A UUID need to be assigned inorder to model to validate. This UUIDs should be overwritten by backend later.
      // This a temporary fix until the model validates @id:null and the older artifacts are patched.
    }

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
          const subTemplate = DataObjectUtil.getSafeSubTemplate(templateJsonObj, targetName);
          for (const childComponent of iterableComponent.children) {
            DataObjectBuilderHandler.buildRecursively(childComponent, dummyTargetObject, subTemplate, buildingMode);
          }
          for (let idx = 0; idx < multiElement.multiInfo.minItems; idx++) {
            const clone = _.cloneDeep(dummyTargetObject as any);
            dataObject[targetName].push(clone);
          }
        }
        if (component instanceof MultiElementComponent) {
          console.log('PATH of multi:', component.path);
          console.log(dataObject[targetName]);
          dataObject[targetName].forEach((child, index) => {
            DataObjectBuilderHandler.addRandomAtId(child);
          });
        }
      } else {
        // Single Element || Template
        dataObject[targetName] = DataObjectUtil.getEmptyObject();
        const subTemplate = DataObjectUtil.getSafeSubTemplate(templateJsonObj, targetName);
        for (const childComponent of iterableComponent.children) {
          DataObjectBuilderHandler.buildRecursively(childComponent, dataObject[targetName], subTemplate, buildingMode);
        }
        if (component instanceof SingleElementComponent) {
          console.log('PATH of singe:', component.path);
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
          const subTemplate = DataObjectUtil.getSafeSubTemplate(templateJsonObj, targetName);
          for (let idx = 0; idx < multiField.multiInfo.minItems; idx++) {
            dataObject[targetName].push(DataObjectUtil.getEmptyValueWrapper(subTemplate, buildingMode));
          }
          if (component?.choiceInfo?.choices?.length > 0) {
            const values = [];
            for (const choice of component.choiceInfo.choices) {
              if (choice.selectedByDefault) {
                values.push(choice.label);
              }
            }
            dataObject[targetName] = DataObjectUtil.getMultiValueWrapper(subTemplate, buildingMode, values);
          }
        }
      } else {
        // SingleFieldComponent
        const subTemplate = DataObjectUtil.getSafeSubTemplate(templateJsonObj, targetName);
        dataObject[targetName] = DataObjectUtil.getEmptyValueWrapper(subTemplate, buildingMode);
        if (component?.choiceInfo?.choices?.length > 0) {
          let value = null;
          for (const choice of component.choiceInfo.choices) {
            if (choice.selectedByDefault) {
              value = choice.label;
            }
          }
          dataObject[targetName] = DataObjectUtil.getSingleValueWrapper(subTemplate, buildingMode, value);
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

  public static addContext(
    component: CedarComponent,
    dataObject: InstanceExtractData,
    templateJsonObj: CedarInputTemplate,
    buildingMode: DataObjectBuildingMode,
  ): void {
    if (buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
      const props = templateJsonObj[JsonSchema.properties];
      const propsContext = props[JsonSchema.atContext];
      const propsContextProps = propsContext[JsonSchema.properties];
      const p: object = {};
      for (const key of Object.keys(propsContextProps)) {
        p[key] = DataObjectUtil.convertTemplateContextNode(propsContextProps[key]);
      }
      dataObject[JsonSchema.atContext] = p;
    }
  }

  public static addRandomAtId(dataObject: InstanceExtractData): void {
    if (!Object.hasOwn(dataObject, JsonSchema.atId)) {
      const uuid = DataObjectUtil.generateGUID();
      const iri = DataObjectUtil.getIriPrefix() + 'template-element-instances/' + uuid;
      dataObject[JsonSchema.atId] = iri;
    }
  }

  injectMultiInstanceService(multiInstanceObjectService: MultiInstanceObjectHandler): void {
    this.multiInstanceObjectService = multiInstanceObjectService;
  }

  buildNewExtractDataObject(
    templateRepresentation: TemplateComponent,
    templateJsonObj: CedarInputTemplate,
  ): InstanceExtractData {
    this.templateJsonObj = templateJsonObj;
    this.templateRepresentation = templateRepresentation;
    this.dataObject = new InstanceExtractData();
    this.buildNewByIterating(this.dataObject, templateJsonObj, DataObjectBuildingMode.EXCLUDE_CONTEXT);
    return this.dataObject;
  }

  buildNewFullDataObject(
    templateRepresentation: TemplateComponent,
    templateJsonObj: CedarInputTemplate,
  ): InstanceFullData {
    this.templateJsonObj = templateJsonObj;
    this.templateRepresentation = templateRepresentation;
    this.dataObjectFull = new InstanceFullData();
    this.buildNewByIterating(this.dataObjectFull, templateJsonObj, DataObjectBuildingMode.INCLUDE_CONTEXT);
    return this.dataObjectFull;
  }

  private buildNewByIterating(
    dataObject: InstanceExtractData,
    templateJsonObj: CedarInputTemplate,
    buildingMode: DataObjectBuildingMode,
  ): void {
    if (this.templateRepresentation != null && this.templateRepresentation.children != null) {
      for (const childComponent of this.templateRepresentation.children) {
        DataObjectBuilderHandler.buildRecursively(childComponent, dataObject, templateJsonObj, buildingMode);
      }
    }
  }
}
