import {
  CedarReaders,
  InstanceDataAttributeValueField,
  InstanceDataContainer,
  InstanceDataEmptyNode,
  JsonNode,
} from 'cedar-model-typescript-library';
import { InstanceObject } from '../models/instance-node.model';
import { indexSegment, InstanceCardinalityReader } from './instance-cardinality-reader';

/**
 * Reports occurrence counts from the model library's parsed instance instead of
 * a hand-written walk over the raw JSON.
 *
 * The walk's hard part is telling a field's value from an element occurrence,
 * and it has to do that from the shape of an untyped object. That is precisely
 * the classification the library performs while parsing, and records in the
 * type of each node — a container is an element, an atom is a value, and an
 * `InstanceDataAttributeValueField` is the attribute-value special case with
 * its names and values already paired up. Reading the counts off that model
 * removes the guesswork rather than reimplementing it more carefully.
 *
 * The counts and paths this emits were required to match the hand-written walk
 * exactly, and did; that walk has since been removed.
 */
export class ModelLibraryInstanceReader implements InstanceCardinalityReader {
  read(instance: InstanceObject, emit: (path: string[], count: number) => void): void {
    const result = CedarReaders.json()
      .getFebruary2024()
      .getTemplateInstanceReader()
      // `JsonNode` is the library's name for a parsed JSON object, and differs
      // from `InstanceObject` only in how it says a value may be anything JSON
      // holds. The second parameter is the path to read at, and is optional —
      // it was being passed `undefined as never` to satisfy the untyped call.
      .readFromObject(instance as unknown as JsonNode);
    ModelLibraryInstanceReader.walk(result.instance.dataContainer, [], emit);
  }

  private static walk(
    container: InstanceDataContainer,
    parentPath: string[],
    emit: (path: string[], count: number) => void,
  ): void {
    for (const key of Object.keys(container.values)) {
      const node = container.values[key];
      const myPath = parentPath.slice();
      myPath.push(key);

      if (Array.isArray(node)) {
        // An empty list is a slot with nothing in it, which the pager still
        // needs an entry for — that falls out of the length.
        emit(myPath.slice(), node.length);
        // Only elements have anything underneath. A list of atoms is a
        // multi-valued field and the count is the whole story.
        if (node[0] instanceof InstanceDataContainer) {
          node.forEach((occurrence, i) => {
            const occurrencePath = myPath.slice();
            occurrencePath.push(indexSegment(i));
            ModelLibraryInstanceReader.walk(occurrence as InstanceDataContainer, occurrencePath, emit);
          });
        }
      } else if (node instanceof InstanceDataAttributeValueField) {
        ModelLibraryInstanceReader.emitAttributeValue(node, myPath, parentPath, emit);
      } else if (node instanceof InstanceDataContainer) {
        // A single element. It gets no count of its own — the walk descends
        // through a dummy occurrence 0 so that paging logic need not
        // distinguish single from multi.
        const occurrencePath = myPath.slice();
        occurrencePath.push(indexSegment(0));
        ModelLibraryInstanceReader.walk(node, occurrencePath, emit);
      } else if (node instanceof InstanceDataEmptyNode) {
        emit(myPath, 0);
      } else {
        // Any atom: a literal, a link, a controlled term.
        emit(myPath, 1);
      }
    }
  }

  /**
   * Attribute-value fields, unpicked back into the two things CEE counts.
   *
   * The library pairs the field's list of attribute names with the values those
   * names point at, and removes the values from the container so they are not
   * mistaken for children. CEE's info tree predates that and still wants both
   * halves: the field itself, holding as many occurrences as there are names,
   * and each named attribute as a single value on the enclosing object.
   *
   * The second half resolves to nothing today — an attribute's name is not a
   * component name, so `setSingleMultiInstance` finds no slot to write to and
   * the emission is discarded. It is kept because the JSON walk emits it too
   * and the two must agree, and because it is not harmless in one case worth
   * knowing about: an attribute named the same as a sibling component would
   * land on that component's slot and overwrite its count. That hazard predates
   * this reader; fixing it means teaching the walk which names are components,
   * which is a change to what a reader is allowed to know.
   */
  private static emitAttributeValue(
    field: InstanceDataAttributeValueField,
    fieldPath: string[],
    parentPath: string[],
    emit: (path: string[], count: number) => void,
  ): void {
    const names = Object.keys(field.values);
    emit(fieldPath, names.length);
    for (const name of names) {
      const attributePath = parentPath.slice();
      attributePath.push(name);
      emit(attributePath, 1);
    }
  }
}
