import { InstanceExtractData } from '../models/instance-extract-data.model';
import { JavascriptTypes } from '../models/javascript-types.model';
import { JsonSchema } from '../models/json-schema.model';
import { indexSegment, InstanceCardinalityReader } from './instance-cardinality-reader';

/**
 * Everything a field's value may carry, and nothing an element occurrence
 * would. `@type` and `skos:notation` appear on controlled terms; `@id` and
 * `rdfs:label` are the IRI-valued pair; `@value` is the literal case.
 */
const VALUE_WRAPPER_KEYS: ReadonlySet<string> = new Set([
  JsonSchema.atValue,
  JsonSchema.atId,
  JsonSchema.rdfsLabel,
  JsonSchema.atType,
  'skos:notation',
]);

/**
 * CEE's original instance reader: a hand-written walk over the raw JSON.
 *
 * Lifted out of `MultiInstanceObjectHandler` unchanged, so the counts it
 * reports can be compared against the ones the model library's parsed instance
 * gives. It tells a field's value from an element occurrence by inspecting the
 * keys, which is the classification the library already does with types.
 */
export class JsonWalkInstanceReader implements InstanceCardinalityReader {
  read(instance: InstanceExtractData, emit: (path: string[], count: number) => void): void {
    JsonWalkInstanceReader.walk(instance, [], emit);
  }

  /**
   * True for a field's value, false for an element occurrence.
   *
   * The two are told apart by what the object holds, and the presence of `@id`
   * is not enough on its own: CEE stamps every element occurrence it writes
   * with an `@id` of its own — a `template-element-instances/…` IRI — so a
   * saved instance's element occurrences looked exactly like IRI-valued fields
   * to a test that only asked whether `@id` was there. They were therefore read
   * as fields and never walked into. The occurrence count of the element itself
   * still came back right, which is why this survived: it is only what is
   * *inside* an element that was lost.
   *
   * A value carries only value keys. An element occurrence carries `@context`
   * and its children, so it fails this and is walked into.
   */
  private static isValueWrapper(node: unknown): boolean {
    if (typeof node !== JavascriptTypes.object || node === null || Array.isArray(node)) {
      return false;
    }
    const keys = Object.keys(node);
    if (keys.length === 0) {
      return false;
    }
    return keys.every((k) => VALUE_WRAPPER_KEYS.has(k));
  }

  private static walk(
    instanceDataIn: InstanceExtractData,
    parentPath: string[],
    emit: (path: string[], count: number) => void,
  ): void {
    const instanceData = JSON.parse(JSON.stringify(instanceDataIn));

    for (const key in instanceData) {
      const myPath: string[] = parentPath.slice();
      myPath.push(key);

      // multi-page element or multi-page field
      if (Array.isArray(instanceData[key]) && instanceData[key].length > 0) {
        emit(myPath.slice(), instanceData[key].length);

        // field component with values or attribute-value field
        const isField =
          // field component with values (text or controlled)
          JsonWalkInstanceReader.isValueWrapper(instanceData[key][0]) ||
          // attribute-value field
          (typeof instanceData[key][0] === JavascriptTypes.string && instanceData[key].length > 0);

        // not a field, so it is a multi-page element component
        if (!isField) {
          for (let i = 0; i < instanceData[key].length; i++) {
            if (i > 0) {
              myPath.pop();
            }
            myPath.push(indexSegment(i));
            JsonWalkInstanceReader.walk(instanceData[key][i], myPath, emit);
          }
        }
        // it's an object, can be a single-page element or a single-page field
      } else if (
        typeof instanceData[key] === JavascriptTypes.object &&
        instanceData[key] !== null &&
        Object.keys(instanceData[key]).length > 0
      ) {
        // single-page field (it's never paginated, so not required for pagination,
        // but still need to have an entry for it in multiInstanceObject)
        if (JsonWalkInstanceReader.isValueWrapper(instanceData[key])) {
          emit(myPath, 1);
        } else {
          // single-page element component
          // push a dummy 0 array element for a consistent multi-paging logic
          // multi-page structure does not differentiate between single- and multi-page components
          myPath.push(indexSegment(0));
          JsonWalkInstanceReader.walk(instanceData[key], myPath, emit);
        }
      } else {
        if (key === JsonSchema.atId || key === JsonSchema.rdfsLabel) {
          // DO NOTHING, we came too deep into a controlled term
        } else {
          // empty fields
          // need to record the component in multiInstanceObject even if it's empty
          emit(myPath, 0);
        }
      }
    }
  }
}
