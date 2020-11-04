import {JsonSchema} from '../models/json-schema.model';
import {CedarModel} from '../models/cedar-model.model';
import {JavascriptTypes} from '../models/javascript-types.model';

export class DataObjectUtil {

  static getEmptyValueWrapper(templateJsonObj: object): object {
    const obj = {};
    obj[JsonSchema.atValue] = null;
    this.injectAtTypeIfAvailable(obj, templateJsonObj);
    return obj;
  }

  static getEmptyObject(): object {
    return {};
  }

  static getEmptyList(): [] {
    return [];
  }

  private static injectAtTypeIfAvailable(obj: object, templateJsonObj: object): void {
    if (templateJsonObj != null) {
      if (templateJsonObj.hasOwnProperty(CedarModel.valueConstraints)) {
        const vc = templateJsonObj[CedarModel.valueConstraints];
        if (vc.hasOwnProperty(CedarModel.numberType)) {
          obj[JsonSchema.atType] = vc[CedarModel.numberType];
        } else if (vc.hasOwnProperty(CedarModel.temporalType)) {
          obj[JsonSchema.atType] = vc[CedarModel.temporalType];
        }
      }
    }
  }

  static convertTemplateContextNode(propsContextProp: object): object {
    let ret = null;
    if (propsContextProp[CedarModel.type] === 'string' && propsContextProp[CedarModel.format] === 'uri') {
      ret = propsContextProp[CedarModel.enum][0];
    } else if (propsContextProp[CedarModel.type] === 'object' && propsContextProp.hasOwnProperty(JsonSchema.properties)) {
      ret = {};
      ret[JsonSchema.atType] = propsContextProp[JsonSchema.properties][JsonSchema.atType][CedarModel.enum][0];
    } else if (propsContextProp.hasOwnProperty(CedarModel.enum)) {
      ret = propsContextProp[CedarModel.enum][0];
    }
    return ret;
  }

  static getSafeSubTemplate(templateJsonObj: object, targetName: string): object {
    let subTemplate: object = null;
    if (templateJsonObj != null) {
      subTemplate = templateJsonObj[JsonSchema.properties][targetName];
      if (subTemplate[CedarModel.type] === JavascriptTypes.array) {
        subTemplate = subTemplate[CedarModel.items];
      }
    }
    return subTemplate;
  }

}
