import {TemplateRepresentation} from '../models/template/template-representation.model';
import {NullTemplateRepresentation} from '../models/template/null-template-representation.model';
import {RegularTemplateRepresentation} from '../models/template/regular-template-representation.model';
import {JsonSchema} from '../models/json-schema.model';
import {SingleComponentRepresentation} from '../models/component/single-component-representation.model';
import {CedarModel} from '../models/cedar-model.model';
import {JavascriptTypes} from '../models/javascript-types.model';
import {ComponentRepresentation} from '../models/component/component-representation.model';
import {MultipleComponentRepresentation} from '../models/component/multiple-component-representation.model';

export class TemplateRepresentationFactory {

  static create(templateJsonObj: object): TemplateRepresentation {
    if (templateJsonObj === null) {
      return new NullTemplateRepresentation();
    } else {
      const repr = new RegularTemplateRepresentation();
      TemplateRepresentationFactory.wrap(templateJsonObj, repr);
      return repr;
    }
  }

  private static wrap(templateJsonObj: object, repr: RegularTemplateRepresentation): void {
    const propertyNames: string[] = TemplateRepresentationFactory.getFilteredSchemaPropertyNames(templateJsonObj);
    for (const name of propertyNames) {
      const templateFragment = templateJsonObj[JsonSchema.properties][name];

      let r: ComponentRepresentation = null;
      let isMulti: boolean;
      const fragmentType = templateFragment[CedarModel.type];
      if (fragmentType === JavascriptTypes.object) {
        isMulti = false;
        r = new SingleComponentRepresentation();
      }
      if (fragmentType === JavascriptTypes.array) {
        isMulti = true;
        r = new MultipleComponentRepresentation();
        const mr: MultipleComponentRepresentation = r as MultipleComponentRepresentation;
        mr.minItems = templateFragment[CedarModel.minItems];
        mr.maxItems = templateFragment[CedarModel.maxItems];
      }
      if (r !== null) {
        r.name = name;
        const dataNode: object = TemplateRepresentationFactory.getDataNode(templateFragment, isMulti);


        const fragmentAtType = templateFragment[JsonSchema.atType];
        if (fragmentAtType === CedarModel.templateFieldType) {
          TemplateRepresentationFactory.extractValueConstraints(dataNode, r);
        }
        if (fragmentAtType === CedarModel.templateElementType) {
          //
        }
      }
      repr.componentsWrapper.components.push(r);
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

  private static extractValueConstraints(dataNode: object, r: ComponentRepresentation):void {
    r.inputType = dataNode[CedarModel.ui][CedarModel.inputType];
    r.requiredValue = dataNode[CedarModel.valueConstraints][CedarModel.requiredValue];
    r.defaultValue = dataNode[CedarModel.valueConstraints][CedarModel.defaultValue];
    r.minLength = dataNode[CedarModel.valueConstraints][CedarModel.minLength];
    r.maxLength = dataNode[CedarModel.valueConstraints][CedarModel.maxLength];

    r.numberType = dataNode[CedarModel.valueConstraints][CedarModel.numberType];
    r.unitOfMeasure = dataNode[CedarModel.valueConstraints][CedarModel.unitOfMeasure];
    r.minValue = dataNode[CedarModel.valueConstraints][CedarModel.minValue];
    r.maxValue = dataNode[CedarModel.valueConstraints][CedarModel.maxValue];
    r.decimalPlace = dataNode[CedarModel.valueConstraints][CedarModel.decimalPlace];

    // r.source = dataNode;
  }

}
