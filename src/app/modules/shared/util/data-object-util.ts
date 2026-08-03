import { JsonSchema } from '../models/json-schema.model';
import { InstanceValueNode } from './instance-value-node';
import { CedarModel } from '../models/cedar-model.model';
import { JavascriptTypes } from '../models/javascript-types.model';
import { TemplateObjectUtil } from './template-object-util';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { CedarEmbeddableMetadataEditorComponent } from '../components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';

export class DataObjectUtil {
  static getEmptyValueWrapper(templateJsonObj: object, buildingMode: DataObjectBuildingMode): object {
    const obj = {};
    if (TemplateObjectUtil.isLInk(templateJsonObj) || TemplateObjectUtil.isExternalAuthorityField(templateJsonObj)) {
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

  /**
   * Strip `@context` and provenance from an instance, leaving the values alone.
   *
   * "Leaving the values alone" used to mean matching exact key counts — two
   * keys with an `@id` and an `rdfs:label` meaning a controlled term, one key
   * with an `@id` meaning a link. Anything else was taken for a container and
   * had its `@id` deleted, so a controlled term or a link that also carried a
   * `@type` — ordinary JSON-LD, and what a host page can perfectly well inject
   * — lost the IRI that *was* its value. The form then showed the field empty,
   * and saving wrote the loss back.
   */
  static deleteContext(obj): void {
    if (InstanceValueNode.isValue(obj)) {
      // A value, whatever else it carries. Nothing here belongs to it.
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

  static getIriPrefix(): string {
    return CedarEmbeddableMetadataEditorComponent.iriPrefix;
  }
}
