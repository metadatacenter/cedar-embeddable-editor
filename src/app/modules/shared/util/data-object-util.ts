import { InstanceValueNode } from './instance-value-node';
import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { InstanceArray, InstanceObject } from '../models/instance-node.model';

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
  static getEmptyValueWrapper(component: FieldComponent, buildingMode: DataObjectBuildingMode): InstanceObject {
    return InstanceValueNode.emptySlot(
      DataObjectUtil.isIriValued(component),
      DataObjectUtil.xsdTypeFor(component, buildingMode),
    );
  }

  static getSingleValueWrapper(
    component: FieldComponent,
    buildingMode: DataObjectBuildingMode,
    value: string,
  ): InstanceObject {
    // A controlled term's default is not a literal, so it gets no `@value` — and
    // no `@type` either, since only numeric and temporal fields have one.
    if (component?.basicInfo?.inputType === InputType.controlled) {
      return InstanceValueNode.emptySlot(true);
    }
    return InstanceValueNode.literalValue(value, DataObjectUtil.xsdTypeFor(component, buildingMode));
  }

  static getMultiValueWrapper(
    component: FieldComponent,
    buildingMode: DataObjectBuildingMode,
    values: string[],
  ): InstanceArray {
    const obj: InstanceArray = [];
    if (component?.basicInfo?.inputType !== InputType.controlled) {
      for (const value of values) {
        // No XSD type on the elements, deliberately: see below.
        obj.push(InstanceValueNode.literalValue(value));
      }
    }
    // A multi field's elements carry no XSD type, and nothing here sets one.
    //
    // What stood here set `@type` as a *property of the array* rather than on
    // its elements. `JSON.stringify` ignores a property on an array, so it never
    // reached an emitted instance — it was transcribed from the code this
    // replaced and kept while the surrounding change was a refactor. Removing it
    // changes no output, which the bundle-level suite confirms, and it was the
    // last place outside `InstanceValueNode` that named a JSON-LD key here.
    //
    // Whether a multi numeric field's elements *should* carry a type is a real
    // question and a real behaviour change; it is not answered by leaving a line
    // that does nothing.
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
      (inputType !== null && EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType as InputType))
    );
  }

  static getEmptyObject(): InstanceObject {
    return {};
  }

  static getEmptyList(): InstanceArray {
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

  // Generating a RFC4122 version 4 compliant GUID
  static generateGUID(): string {
    let d = Date.now();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  static arraysEqual(arr1: unknown[], arr2: unknown[]): boolean {
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
        if (!DataObjectUtil.arraysEqual(arr1[i] as unknown[], arr2[i] as unknown[])) {
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
