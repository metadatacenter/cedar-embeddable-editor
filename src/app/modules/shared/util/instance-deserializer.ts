import {
  CedarReaders,
  InstanceDataAttributeValueField,
  InstanceDataAttributeValueFieldName,
  InstanceDataAtomType,
  InstanceDataContainer,
  InstanceDataEmptyAtom,
  TemplateInstance,
  JsonNode,
} from 'cedar-model-typescript-library';
import { InstanceObject } from '../models/instance-node.model';

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
 * while parsing and records the answer in the node's type. One classified node
 * needs an editing projection: the reader packs an attribute-value field's names
 * and sibling values into `InstanceDataAttributeValueField`, while CEE's pager
 * edits those names as occurrences. `makeAttributeValuesEditable` unpacks that
 * typed node into typed name slots and sibling atoms; it does not inspect JSON.
 *
 * There was. The model was written straight back out to two JSON trees: `full`,
 * the whole artifact, and `extract`, the same thing with the envelope left off.
 * Four private methods walked the model rebuilding it as plain objects, because
 * plain objects were what CEE's handlers knew how to edit. They edit the model
 * now, so the walk is gone: `full` is the instance and `extract` is its data
 * container, which *is* the instance without its envelope.
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
  ): { full: TemplateInstance; extract: InstanceObject } {
    const instance = CedarReaders.json()
      .getFebruary2024()
      .getTemplateInstanceReader()
      .readFromObject(instanceJson as JsonNode).instance;

    InstanceDeserializer.makeAttributeValuesEditable(instance.dataContainer);

    if (report) {
      InstanceDeserializer.reportDiscarded(instance.dataContainer, [], report);
    }

    return { full: instance, extract: instance.dataContainer };
  }

  /**
   * Convert the reader's packed attribute-value node into CEE's editable shape.
   *
   * The wire form is a list of names plus one sibling value per name. The model
   * reader pairs those halves into `InstanceDataAttributeValueField`, which is a
   * useful read model but is not a list: treating it as one crashed the pager on
   * the first change-detection pass after a host saved and re-injected an
   * instance. CEE creates and edits the equivalent typed list shape itself, so
   * loaded instances are brought to that same shape once, at the input boundary.
   */
  private static makeAttributeValuesEditable(container: InstanceDataContainer): void {
    for (const key of Object.keys(container.values)) {
      const node = container.values[key];

      if (node instanceof InstanceDataAttributeValueField) {
        const names = Object.keys(node.values);
        container.setValue(
          key,
          names.map((name) => new InstanceDataAttributeValueFieldName(name)),
        );
        for (const name of names) {
          container.setValue(name, node.values[name]);
        }
        continue;
      }

      if (Array.isArray(node)) {
        node.forEach((item) => {
          if (item instanceof InstanceDataContainer) {
            InstanceDeserializer.makeAttributeValuesEditable(item);
          }
        });
      } else if (node instanceof InstanceDataContainer) {
        InstanceDeserializer.makeAttributeValuesEditable(node);
      }
    }
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
}
