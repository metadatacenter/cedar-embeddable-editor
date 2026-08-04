import { JsonSchema } from 'cedar-model-typescript-library';
import { InstanceValueNode } from './instance-value-node';
import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { IriPrefix } from './iri-prefix';

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
    return InstanceValueNode.emptySlotJson(
      DataObjectUtil.isIriValued(component),
      DataObjectUtil.xsdTypeFor(component, buildingMode),
    );
  }

  static getSingleValueWrapper(component: FieldComponent, buildingMode: DataObjectBuildingMode, value: string): object {
    // A controlled term's default is not a literal, so it gets no `@value` — and
    // no `@type` either, since only numeric and temporal fields have one.
    if (component?.basicInfo?.inputType === InputType.controlled) {
      return InstanceValueNode.emptySlotJson(true);
    }
    return InstanceValueNode.literalJson(value, DataObjectUtil.xsdTypeFor(component, buildingMode));
  }

  static getMultiValueWrapper(component: FieldComponent, buildingMode: DataObjectBuildingMode, values: string[]): object {
    const obj = [];
    if (component?.basicInfo?.inputType !== InputType.controlled) {
      for (const value of values) {
        // No XSD type on the elements, deliberately: see below.
        obj.push(InstanceValueNode.literalJson(value));
      }
    }
    if (buildingMode === DataObjectBuildingMode.INCLUDE_CONTEXT) {
      // Transcribed as found. This sets `@type` as a *property of the array*,
      // which `JSON.stringify` ignores — so it has never reached the emitted
      // instance, and the elements have never carried a type. Kept because
      // removing it and kept because adding the type to the elements are both
      // behaviour changes to what a multi numeric field stores, and this commit
      // is a refactor. Worth revisiting on its own.
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

  /**
   * The XSD type a numeric or temporal value carries alongside itself in the
   * full copy, or null for every other field.
   *
   * Public because it is needed in two places that must agree: the initial
   * structure build, and an in-place value edit. `changeValue` rebuilds the
   * value node from scratch, so without re-attaching this it drops the `@type`
   * the build put there — and a temporal value with no `@type` is one the server
   * rejects (its instance schema makes `@type` required), so the save the user
   * just made fails and the value is lost.
   */
  static xsdTypeForFullCopy(component: FieldComponent): string | null {
    return component?.numberInfo?.numberType ?? component?.valueInfo?.temporalType ?? null;
  }

  /**
   * The XSD type a value carries alongside itself, if it carries one.
   *
   * Only numeric and temporal fields do, and only in the full copy — the type is
   * part of the artifact rather than of the value the form is editing.
   */
  private static xsdTypeFor(component: FieldComponent, buildingMode: DataObjectBuildingMode): string | null {
    if (buildingMode !== DataObjectBuildingMode.INCLUDE_CONTEXT) {
      return null;
    }
    return DataObjectUtil.xsdTypeForFullCopy(component);
  }

  /** A numeric or temporal value declares its XSD type alongside itself. */
  private static injectAtTypeIfAvailable(obj: object, component: FieldComponent): void {
    const xsdType = DataObjectUtil.xsdTypeForFullCopy(component);
    if (xsdType != null) {
      obj[JsonSchema.atType] = xsdType;
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
    return IriPrefix.get();
  }
}
