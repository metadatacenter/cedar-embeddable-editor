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

export class TemplateRepresentationFactory {

  static create(templateJsonObj: object): TemplateComponent {
    if (templateJsonObj === null) {
      return new NullTemplateComponent();
    } else {
      const template = new CedarTemplate();
      TemplateRepresentationFactory.wrap(templateJsonObj, template);
      return template;
    }
  }

  private static wrap(templateJsonObj: object, component: CedarComponent): void {
    const propertyNames: string[] = TemplateRepresentationFactory.getFilteredSchemaPropertyNames(templateJsonObj);
    for (const name of propertyNames) {
      const templateFragment = templateJsonObj[JsonSchema.properties][name];

      let isMulti: boolean;
      const fragmentType = templateFragment[CedarModel.type];
      if (fragmentType === JavascriptTypes.object) {
        isMulti = false;
      } else if (fragmentType === JavascriptTypes.array) {
        isMulti = true;
      } else {
        throw new Error(
          'Invalid node value of ' + CedarModel.type + '. Value found:"' + fragmentType + '". ' +
          'Expected "' + JavascriptTypes.object + '" or "' + JavascriptTypes.array + '"!'
        );
      }

      const dataNode: object = TemplateRepresentationFactory.getDataNode(templateFragment, isMulti);
      const fragmentAtType = dataNode[JsonSchema.atType];
      let r: CedarComponent = null;

      if (fragmentAtType === CedarModel.templateFieldType) {
        if (isMulti) {
          r = new MultiFieldComponent();
        } else {
          r = new SingleFieldComponent();
        }
        TemplateRepresentationFactory.extractValueConstraints(dataNode, r as FieldComponent);
      } else if (fragmentAtType === CedarModel.templateElementType) {
        if (isMulti) {
          r = new MultiElementComponent();
        } else {
          r = new SingleElementComponent();
        }
        TemplateRepresentationFactory.wrap(dataNode, r);
      }

      if (r !== null) {
        const wrapperElement: ElementComponent = component as ElementComponent;
        wrapperElement.children.push(r);
        r.name = name;
      }

      if (isMulti) {
        const mr = r as MultiComponent;
        TemplateRepresentationFactory.extractMultiInfo(templateFragment, mr);
      }

    }
  }

  private static getFilteredSchemaPropertyNames(jsonObj: object): string[] {
    const names: string[] = [];
    if (jsonObj.hasOwnProperty(JsonSchema.properties)) {
      const prMap = jsonObj[JsonSchema.properties];
      if (prMap instanceof Object) {
        for (const name of Object.keys(prMap)) {
          if (!JsonSchema.builtInProperties.has(name)) {
            names.push(name);
          }
        }
      }
    }
    return names;
  }

  private static getDataNode(templateFragment: any, isMulti: boolean): object {
    if (isMulti) {
      return templateFragment[CedarModel.items];
    } else {
      return templateFragment;
    }
  }

  private static extractValueConstraints(dataNode: object, fc: FieldComponent): void {
    fc.basicInfo.inputType = dataNode[CedarModel.ui][CedarModel.inputType];

    const vc: object = dataNode[CedarModel.valueConstraints];
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
    for (const pair of vc[CedarModel.literals]) {
      const option = new ChoiceOption();
      option.label = pair[CedarModel.label];
      option.selectedByDefault = pair[CedarModel.selectedByDefault];
      fc.choiceInfo.choices.push(option);
    }

  }

  private static extractMultiInfo(templateFragment: object, mr: MultiComponent): void {
    mr.multiInfo.minItems = templateFragment[CedarModel.minItems];
    mr.multiInfo.maxItems = templateFragment[CedarModel.maxItems];
  }
}
