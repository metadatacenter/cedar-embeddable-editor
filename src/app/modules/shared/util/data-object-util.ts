import {JsonSchema} from '../models/json-schema.model';
import {CedarModel} from '../models/cedar-model.model';
import {JavascriptTypes} from '../models/javascript-types.model';
import {TemplateObjectUtil} from './template-object-util';
import {DataObjectBuildingMode} from '../models/enum/data-object-building-mode.model';

export class DataObjectUtil {

  static getEmptyValueWrapper(templateJsonObj: object, buildingMode: DataObjectBuildingMode): object {
    const obj = {};
    if (!TemplateObjectUtil.hasControlledInfo(templateJsonObj) ) {
      obj[JsonSchema.atValue] = null;
    }
    if (buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
      this.injectAtTypeIfAvailable(obj, templateJsonObj);
    }
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

  // Generating a RFC4122 version 4 compliant GUID
  static generateGUID(): string {
    let d = Date.now();
    const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return guid;
  }

  static arraysEqual(arr1, arr2): boolean {
    // if the other array is a falsy value, return
    if (!arr2) {
      return false;
    }

    // compare lengths - can save a lot of time
    if (arr1.length !== arr2.length) {
      return false;
    }

    for (let i = 0, l = arr1.length; i < l; i++) {
      // Check if we have nested arrays
      if (arr1[i] instanceof Array && arr2[i] instanceof Array) {
        // recurse into the nested arrays
        if (!arr1[i].equals(arr2[i])) {
          return false;
        }
      } else if (arr1[i] !== arr2[i]) {
        // Warning - two different object instances will never be equal: {x:20} != {x:20}
        return false;
      }
    }
    return true;
  }

}
