import { JsonSchema } from '../models/json-schema.model';
import { InstanceValueNode } from './instance-value-node';
import { CedarModel } from '../models/cedar-model.model';
import { JavascriptTypes } from '../models/javascript-types.model';
import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { CedarEmbeddableMetadataEditorComponent } from '../components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component';

export class DataObjectUtil {
  /**
   * The slot a field's value will go in, before there is a value.
   *
   * Which slot depends only on what kind of field it is, and the parsed
   * component already says: an IRI-valued field gets `{}`, because its value
   * will be an `@id` and there is no `@value` to be null; a controlled term
   * likewise; everything else gets `{'@value': null}`. Numeric and temporal
   * fields carry their `@type` alongside in the full copy.
   *
   * These used to be answered by re-reading the field's own slice of the raw
   * template — `isLInk`, `isExternalAuthorityField`, `hasControlledInfo`, and a
   * dig into `_valueConstraints` for the `@type` — which meant the builder
   * walked the template JSON in step with the component tree it was already
   * walking, purely to re-derive things the tree had.
   */
  static getEmptyValueWrapper(component: FieldComponent, buildingMode: DataObjectBuildingMode): object {
    const obj = {};
    if (!DataObjectUtil.isIriValued(component)) {
      obj[JsonSchema.atValue] = null;
    }
    if (buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
      this.injectAtTypeIfAvailable(obj, component);
    }
    return obj;
  }

  static getSingleValueWrapper(component: FieldComponent, buildingMode: DataObjectBuildingMode, value: string): object {
    const obj = {};
    if (component?.basicInfo?.inputType !== InputType.controlled) {
      obj[JsonSchema.atValue] = value;
    }
    if (buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
      this.injectAtTypeIfAvailable(obj, component);
    }
    return obj;
  }

  static getMultiValueWrapper(component: FieldComponent, buildingMode: DataObjectBuildingMode, values: string[]): object {
    const obj = [];
    if (component?.basicInfo?.inputType !== InputType.controlled) {
      for (const value of values) {
        const subObj = {};
        subObj[JsonSchema.atValue] = value;
        obj.push(subObj);
      }
    }
    if (buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
      this.injectAtTypeIfAvailable(obj, component);
    }
    return obj;
  }

  /**
   * True when the field's value is an IRI, so its empty slot is `{}`.
   *
   * Links and the external authority types store the IRI as `@id`; a controlled
   * term stores `@id` plus a label. None of them has a `@value` to leave null.
   */
  private static isIriValued(component: FieldComponent): boolean {
    const inputType = component?.basicInfo?.inputType;
    return (
      inputType === InputType.link ||
      inputType === InputType.controlled ||
      EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType)
    );
  }

  static getEmptyObject(): object {
    return {};
  }

  static getEmptyList(): [] {
    return [];
  }

  /** A numeric or temporal value declares its XSD type alongside itself. */
  private static injectAtTypeIfAvailable(obj: object, component: FieldComponent): void {
    const numberType = component?.numberInfo?.numberType;
    const temporalType = component?.valueInfo?.temporalType;
    if (numberType != null) {
      obj[JsonSchema.atType] = numberType;
    } else if (temporalType != null) {
      obj[JsonSchema.atType] = temporalType;
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
