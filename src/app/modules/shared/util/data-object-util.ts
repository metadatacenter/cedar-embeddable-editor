import { JsonSchema } from '../models/json-schema.model';
import { CedarModel } from '../models/cedar-model.model';
import { JavascriptTypes } from '../models/javascript-types.model';
import { TemplateObjectUtil } from './template-object-util';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';

export class DataObjectUtil {
  static getEmptyValueWrapper(templateJsonObj: object, buildingMode: DataObjectBuildingMode): object {
    const obj = {};
    if (TemplateObjectUtil.isLInk(templateJsonObj)) {
      // do nothing, leave object empty
    } else if (!TemplateObjectUtil.hasControlledInfo(templateJsonObj)) {
      obj[JsonSchema.atValue] = null;
    }
    if (buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
      this.injectAtTypeIfAvailable(obj, templateJsonObj);
    }
    return obj;
  }

  static getSingleValueWrapper(templateJsonObj: object, buildingMode: DataObjectBuildingMode, value: string): object {
    const obj = {};
    if (!TemplateObjectUtil.hasControlledInfo(templateJsonObj)) {
      obj[JsonSchema.atValue] = value;
    }
    if (buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
      this.injectAtTypeIfAvailable(obj, templateJsonObj);
    }
    return obj;
  }

  static getMultiValueWrapper(templateJsonObj: object, buildingMode: DataObjectBuildingMode, values: string[]): object {
    const obj = [];
    if (!TemplateObjectUtil.hasControlledInfo(templateJsonObj)) {
      for (const value of values) {
        const subObj = {};
        subObj[JsonSchema.atValue] = value;
        obj.push(subObj);
      }
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
      if (Object.hasOwn(templateJsonObj, CedarModel.valueConstraints)) {
        const vc = templateJsonObj[CedarModel.valueConstraints];
        if (Object.hasOwn(vc, CedarModel.numberType)) {
          obj[JsonSchema.atType] = vc[CedarModel.numberType];
        } else if (Object.hasOwn(vc, CedarModel.temporalType)) {
          obj[JsonSchema.atType] = vc[CedarModel.temporalType];
        }
      }
    }
  }

  static convertTemplateContextNode(propsContextProp: object): object {
    let ret = null;
    if (propsContextProp[CedarModel.type] === 'string' && propsContextProp[CedarModel.format] === 'uri') {
      ret = propsContextProp[CedarModel.enum][0];
    } else if (
      propsContextProp[CedarModel.type] === 'object' &&
      Object.hasOwn(propsContextProp, JsonSchema.properties)
    ) {
      ret = {};
      ret[JsonSchema.atType] = propsContextProp[JsonSchema.properties][JsonSchema.atType][CedarModel.enum][0];
    } else if (Object.hasOwn(propsContextProp, CedarModel.enum)) {
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
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
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

  static deleteContext(obj): void {
    const keyCount = Object.keys(obj).length;
    if (keyCount === 2 && Object.hasOwn(obj, JsonSchema.atId) && Object.hasOwn(obj, JsonSchema.rdfsLabel)) {
      // do nothing, it is a controlled term
    } else if (keyCount === 1 && Object.hasOwn(obj, JsonSchema.atId)) {
      // do nothing, it is a link
    } else {
      Object.keys(obj).forEach((key) => {
        delete obj[JsonSchema.atContext];
        delete obj[JsonSchema.atId];
        delete obj[JsonSchema.oslcModifiedBy];
        delete obj[JsonSchema.pavCreatedOn];
        delete obj[JsonSchema.pavLastUpdatedOn];
        delete obj[JsonSchema.pavCreatedBy];
        delete obj[JsonSchema.schemaIsBasedOn];
        delete obj[JsonSchema.schemaName];
        delete obj[JsonSchema.schemaDescription];
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          DataObjectUtil.deleteContext(obj[key]);
        }
      });
    }
  }
}
