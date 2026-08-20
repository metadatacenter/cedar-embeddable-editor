import { InstanceValueNode } from './instance-value-node';
import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { InstanceArray, InstanceNode, InstanceObject } from '../models/instance-node.model';
import { InstanceDataContainer } from 'cedar-model-typescript-library';
import { isAuthorityTerm } from '../models/authority/authority-term.guard';

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
  static getEmptyValueWrapper(component: FieldComponent): InstanceNode {
    return InstanceValueNode.emptySlot(
      DataObjectUtil.isIriValued(component),
      DataObjectUtil.xsdTypeForFullCopy(component),
    );
  }

  /**
   * Values a newly built field receives from its declaration.
   *
   * A default belongs to the instance structure, not to whichever widget happens
   * to be rendered first. Choice fields encode it on their selected literals;
   * ordinary fields put it on `valueInfo`; controlled terms need both halves of
   * their IRI/label pair. Keeping those three representations together here makes
   * hidden fields, later pages and newly added occurrences behave identically.
   */
  static getDefaultValueWrappers(component: FieldComponent): InstanceArray {
    const selectedChoices = component.choiceInfo.choices.filter((choice) => choice.selectedByDefault);
    if (selectedChoices.length > 0) {
      // Multi values historically carry no XSD type. Choice values are literals,
      // so there is no type to preserve here in either cardinality.
      return selectedChoices.map((choice) => InstanceValueNode.literalValue(choice.label));
    }

    const declared = component.valueInfo.defaultValue;
    if (isAuthorityTerm(declared)) {
      return [InstanceValueNode.iriValue(declared.iri, declared.label)];
    }
    // The TypeScript JSON reader preserves `defaultValue: ""` while its YAML
    // reader drops it; the Java reader also treats it as absent. It cannot seed
    // a meaningful answer and must not make instance construction depend on the
    // template's serialization.
    if (declared === '') {
      return [];
    }
    if (component.basicInfo.inputType === InputType.controlled) {
      // A controlled default without its IRI/label shape is not a usable term.
      return [];
    }
    if (typeof declared === 'string' && DataObjectUtil.isIriValued(component)) {
      return [InstanceValueNode.iriValue(declared)];
    }
    if (typeof declared === 'string' || typeof declared === 'boolean') {
      return [InstanceValueNode.literalValue(String(declared), DataObjectUtil.xsdTypeForFullCopy(component))];
    }
    return [];
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
    return new InstanceDataContainer();
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
