import { JsonSchema } from '../models/json-schema.model';
import { InstanceValueNode } from './instance-value-node';
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

  static getIriPrefix(): string {
    return CedarEmbeddableMetadataEditorComponent.iriPrefix;
  }
}
