import {
  CedarReaders,
  CedarWriters,
  InstanceDataAtomType,
  InstanceDataAttributeValueField,
  InstanceDataEmptyAtom,
  InstanceDataContainer,
  JsonTemplateInstanceWriter,
  TemplateInstance,
  JsonNode,
} from 'cedar-model-typescript-library';
import { InstanceExtractData } from '../models/instance-extract-data.model';
import { InstanceFullData } from '../models/instance-full-data.model';

/**
 * Take in an instance a host page handed us.
 *
 * The mirror of `InstanceSerializer`, and the other half of the same argument.
 * An instance arriving from outside is a CEDAR artifact, so what one *is* — and
 * which part of it is a value and which part is the envelope wrapped around it
 * — is the model's business, not CEE's.
 *
 * CEE used to answer that itself: clone the document twice, then walk one copy
 * deleting nine envelope keys wherever it found them, guessing from an untyped
 * object which nodes were values to be left alone. The guess was made by
 * counting keys, and it destroyed data — a controlled term or a link carrying a
 * `@type`, which is ordinary JSON-LD, has too many keys and had its `@id`
 * deleted, so the field showed empty and saving wrote the loss back.
 *
 * Here the document is read once, by the library, which classifies every node
 * while parsing and records the answer in the node's type. The two trees CEE
 * works with are then *projections* of that model:
 *
 * - `full` is what the library writes back — the whole artifact, envelope and
 *   all, normalised to what CEDAR says an instance looks like.
 * - `extract` is the same model with the envelope left off, which is what the
 *   handlers and the quality report read.
 *
 * Both stay plain mutable objects, because the widgets hold references into
 * them and edit them in place. The point is not that CEE stops using objects —
 * it is that no code here decides what a node means by looking at its keys.
 */
export class InstanceDeserializer {
  /**
   * Read an injected instance into the two trees CEE edits.
   *
   * `report`, when given, is told about anything the read threw away. Optional
   * because several callers only want the trees, and because a reader that
   * *can* report is the point — a silent discard is the thing being fixed.
   */
  static read(
    instanceJson: object,
    report?: (message: string) => void,
  ): { full: InstanceFullData; extract: InstanceExtractData } {
    const instance = CedarReaders.json()
      .getFebruary2024()
      .getTemplateInstanceReader()
      .readFromObject(instanceJson as JsonNode).instance;

    if (report) {
      InstanceDeserializer.reportDiscarded(instance.dataContainer, [], report);
    }

    return {
      full: InstanceDeserializer.writeFull(instance),
      extract: InstanceDeserializer.container(instance.dataContainer) as InstanceExtractData,
    };
  }

  /**
   * Tell the caller about content the read could not make a value out of.
   *
   * A CEDAR value is a literal or an IRI. `{"rdfs:label": "Some Term"}` is
   * neither — a label with nothing to label — so the library reads it as empty,
   * and the field shows blank. That much is correct. Doing it in silence was
   * not: a host page could inject a half-written controlled term, get an empty
   * field back, and have no way to find out why.
   *
   * The library now keeps what it dropped on the atom, which is what makes this
   * possible without CEE re-inspecting the JSON it just handed over.
   */
  private static reportDiscarded(
    container: InstanceDataContainer,
    parentPath: string[],
    report: (message: string) => void,
  ): void {
    for (const key of Object.keys(container.values)) {
      const path = [...parentPath, key];
      InstanceDeserializer.reportNode(container.values[key], path, report);
    }
  }

  private static reportNode(node: InstanceDataAtomType, path: string[], report: (message: string) => void): void {
    if (Array.isArray(node)) {
      (node as InstanceDataAtomType[]).forEach((item, i) =>
        InstanceDeserializer.reportNode(item, [...path.slice(0, -1), `${path[path.length - 1]}[${i}]`], report),
      );
      return;
    }
    if (node instanceof InstanceDataContainer) {
      InstanceDeserializer.reportDiscarded(node, path, report);
      return;
    }
    if (node instanceof InstanceDataEmptyAtom && node.hasDiscardedContent()) {
      report(
        `The instance has no usable value for "${path.join(' > ')}": ${JSON.stringify(node.discarded)} is neither a ` +
          'literal nor an IRI, so the field is empty. A label with no @id names no term.',
      );
    }
  }

  private static writeFull(instance: TemplateInstance): InstanceFullData {
    return CedarWriters.json()
      .getFebruary2024()
      .getTemplateInstanceWriter()
      .getAsJsonNode(instance) as InstanceFullData;
  }

  /**
   * One element's worth of the extract: its children, and nothing of itself.
   *
   * An element occurrence carries an `@id` and provenance in the full tree. The
   * extract has neither, at any depth — that is the whole difference between
   * the two trees.
   */
  private static container(container: InstanceDataContainer): object {
    const out: object = {};
    for (const key of Object.keys(container.values)) {
      const node = container.values[key];
      if (node instanceof InstanceDataAttributeValueField) {
        InstanceDeserializer.attributeValueField(node, key, out);
      } else {
        out[key] = InstanceDeserializer.node(node);
      }
    }
    return out;
  }

  /** A value, an element, or a list of either — dispatched on type, not shape. */
  private static node(node: InstanceDataAtomType): unknown {
    if (Array.isArray(node)) {
      return (node as InstanceDataAtomType[]).map((item) => InstanceDeserializer.node(item));
    }
    if (node instanceof InstanceDataContainer) {
      return InstanceDeserializer.container(node);
    }
    return JsonTemplateInstanceWriter.writeValueNode(node);
  }

  /**
   * An attribute-value field, unpicked into the two halves CEE keeps.
   *
   * The library pairs the field's attribute names with their values and holds
   * both on one node. CEE's trees predate that and keep them apart: the field's
   * own key holds the list of names, and each named attribute sits on the
   * enclosing object as a value in its own right — which is also how it appears
   * in the instance CEE writes back out.
   */
  private static attributeValueField(field: InstanceDataAttributeValueField, key: string, out: object): void {
    const names = Object.keys(field.values);
    out[key] = names.slice();
    for (const name of names) {
      out[name] = JsonTemplateInstanceWriter.writeValueNode(field.values[name]);
    }
  }
}
