import {JsonSchema} from '../models/json-schema.model';
import {CedarModel} from '../models/cedar-model.model';
import {JavascriptTypes} from '../models/javascript-types.model';
import {CedarComponent} from '../models/component/cedar-component.model';
import {MultiElementComponent} from '../models/element/multi-element-component.model';
import {CedarTemplate} from '../models/template/cedar-template.model';
import {NullTemplateComponent} from '../models/template/null-template-component.model';
import {TemplateComponent} from '../models/template/template-component.model';
import {MultiFieldComponent} from '../models/field/multi-field-component.model';
import {SingleFieldComponent} from '../models/field/single-field-component.model';
import {SingleElementComponent} from '../models/element/single-element-component.model';
import {MultiComponent} from '../models/component/multi-component.model';
import {ElementComponent} from '../models/component/element-component.model';
import {FieldComponent} from '../models/component/field-component.model';
import {ChoiceOption} from '../models/info/choice-option.model';
import {CedarInputTemplate} from '../models/cedar-input-template.model';
import {StaticFieldComponent} from '../models/static/static-field-component.model';

export class TemplateRepresentationFactory {

  static create(inputTemplate: CedarInputTemplate): TemplateComponent {
    if (inputTemplate === null) {
      return new NullTemplateComponent();
    } else {
      const template = new CedarTemplate();
      TemplateRepresentationFactory.wrap(inputTemplate, inputTemplate, template, []);
      TemplateRepresentationFactory.extractTemplateLabels(inputTemplate, template);
      return template;
    }
  }

  private static isFragmentMulti(templateFragment: object): boolean {
    const fragmentType = templateFragment[CedarModel.type];
    if (fragmentType === JavascriptTypes.object) {
      return false;
    } else if (fragmentType === JavascriptTypes.array) {
      return true;
    } else {
      throw new Error(
        'Invalid node value of ' + CedarModel.type + '. Value found:"' + fragmentType + '". ' +
        'Expected "' + JavascriptTypes.object + '" or "' + JavascriptTypes.array + '"!'
      );
    }
  }

  private static wrap(templateJsonObj: object, parentJsonObj: object, component: CedarComponent, parentPath: string[]): void {
    // const propertyNames: string[] = TemplateRepresentationFactory.getFilteredSchemaPropertyNames(templateJsonObj);
    // console.log(propertyNames);
    const propertyNames: string[] = TemplateRepresentationFactory.getOrderedPropertyNames(templateJsonObj);
    for (const name of propertyNames) {
      console.log(name);
      const templateFragment = templateJsonObj[JsonSchema.properties][name];

      const isMulti: boolean = TemplateRepresentationFactory.isFragmentMulti(templateFragment);

      const parentDataNode: object = TemplateRepresentationFactory.getDataNode(parentJsonObj);
      const dataNode: object = TemplateRepresentationFactory.getDataNode(templateFragment);
      const fragmentAtType = dataNode[JsonSchema.atType];
      let r: CedarComponent = null;

      const myPath: string[] = parentPath.slice();
      myPath.push(name);

      if (fragmentAtType === CedarModel.templateFieldType) {
        if (isMulti) {
          r = new MultiFieldComponent();
        } else {
          r = new SingleFieldComponent();
        }
        TemplateRepresentationFactory.extractValueConstraints(dataNode, r as FieldComponent);
        TemplateRepresentationFactory.extractLabels(dataNode, parentDataNode, name, r as FieldComponent);
      } else if (fragmentAtType === CedarModel.templateElementType) {
        if (isMulti) {
          r = new MultiElementComponent();
        } else {
          r = new SingleElementComponent();
        }
        TemplateRepresentationFactory.extractLabels(dataNode, parentDataNode, name, r as FieldComponent);
        TemplateRepresentationFactory.wrap(dataNode, templateJsonObj, r, myPath);
      } else if (fragmentAtType === CedarModel.templateStaticFieldType) {
        r = new StaticFieldComponent();
        TemplateRepresentationFactory.extractStaticData(dataNode, parentDataNode, name, r as StaticFieldComponent);
      }

      if (r !== null) {
        const wrapperElement: ElementComponent = component as ElementComponent;
        wrapperElement.children.push(r);
        r.name = name;
        r.path = myPath;
      }

      if (isMulti) {
        const mr = r as MultiComponent;
        TemplateRepresentationFactory.extractMultiInfo(templateFragment, mr);
      }

    }
  }

  // private static getFilteredSchemaPropertyNames(jsonObj: object): string[] {
  //   const names: string[] = [];
  //   if (jsonObj.hasOwnProperty(JsonSchema.properties)) {
  //     const prMap = jsonObj[JsonSchema.properties];
  //     if (prMap instanceof Object) {
  //       for (const name of Object.keys(prMap)) {
  //         if (!JsonSchema.builtInProperties.has(name)) {
  //           names.push(name);
  //         }
  //       }
  //     }
  //   }
  //   return names;
  // }

  private static getOrderedPropertyNames(jsonObj: object): string[] {
    const order: string[] = [];
    if (jsonObj.hasOwnProperty(CedarModel.ui)) {
      const uiMap = jsonObj[CedarModel.ui];
      if (uiMap.hasOwnProperty(CedarModel.order)) {
        return uiMap[CedarModel.order];
      }
    }
    return order;
  }

  private static getDataNode(templateFragment: object): object {
    if (templateFragment == null) {
      return null;
    }
    const isMulti: boolean = TemplateRepresentationFactory.isFragmentMulti(templateFragment);
    if (isMulti) {
      return templateFragment[CedarModel.items];
    } else {
      return templateFragment;
    }
  }

  private static extractValueConstraints(dataNode: object, fc: FieldComponent): void {
    fc.basicInfo.inputType = dataNode[CedarModel.ui][CedarModel.inputType];

    const vc: object = dataNode[CedarModel.valueConstraints];
    if (vc != null) {
      fc.valueInfo.requiredValue = vc[CedarModel.requiredValue];
      fc.valueInfo.defaultValue = vc[CedarModel.defaultValue];
      fc.valueInfo.minLength = vc[CedarModel.minLength];
      fc.valueInfo.maxLength = vc[CedarModel.maxLength];

      fc.numberInfo.numberType = vc[CedarModel.numberType];
      fc.numberInfo.unitOfMeasure = vc[CedarModel.unitOfMeasure];
      fc.numberInfo.minValue = vc[CedarModel.minValue];
      fc.numberInfo.maxValue = vc[CedarModel.maxValue];
      fc.numberInfo.decimalPlace = vc[CedarModel.decimalPlace];

      fc.choiceInfo.multipleChoice = vc[CedarModel.multipleChoice];
      if (vc[CedarModel.literals] !== undefined) {
        for (const pair of vc[CedarModel.literals]) {
          const option = new ChoiceOption();
          option.label = pair[CedarModel.label];
          option.selectedByDefault = pair[CedarModel.selectedByDefault];
          fc.choiceInfo.choices.push(option);
        }
      }
    }
  }

  private static extractLabels(dataNode: object, parentDataNode: object, name: string, fc: FieldComponent): void {
    fc.labelInfo.preferredLabel = dataNode[CedarModel.skosPrefLabel];
    if (parentDataNode != null) {
      if (parentDataNode[CedarModel.ui][CedarModel.propertyDescriptions] !== undefined) {
        fc.labelInfo.description = parentDataNode[CedarModel.ui][CedarModel.propertyDescriptions][name];
      }
      if (parentDataNode[CedarModel.ui][CedarModel.propertyLabels] !== undefined) {
        fc.labelInfo.label = parentDataNode[CedarModel.ui][CedarModel.propertyLabels][name];
      }
    }
  }

  private static extractMultiInfo(templateFragment: object, mr: MultiComponent): void {
    mr.multiInfo.minItems = templateFragment[CedarModel.minItems];
    mr.multiInfo.maxItems = templateFragment[CedarModel.maxItems];
  }

  private static extractTemplateLabels(templateJsonObj: object, template: CedarTemplate): void {
    template.labelInfo.label = templateJsonObj[JsonSchema.schemaName];
    template.labelInfo.description = templateJsonObj[JsonSchema.schemaDescription];
  }

  private static extractStaticData(dataNode: object, parentDataNode: object, name: string, sfc: StaticFieldComponent): void {
    sfc.basicInfo.inputType = dataNode[CedarModel.ui][CedarModel.inputType];
    sfc.labelInfo.preferredLabel = dataNode[CedarModel.skosPrefLabel];
    if (parentDataNode != null) {
      if (parentDataNode[CedarModel.ui][CedarModel.propertyDescriptions] !== undefined) {
        sfc.labelInfo.description = parentDataNode[CedarModel.ui][CedarModel.propertyDescriptions][name];
      }
      if (parentDataNode[CedarModel.ui][CedarModel.propertyLabels] !== undefined) {
        sfc.labelInfo.label = parentDataNode[CedarModel.ui][CedarModel.propertyLabels][name];
      }
    }
  }
}
