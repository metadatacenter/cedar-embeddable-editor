/**
 * Reading a value out of the document CEE hands a host, without naming a key.
 *
 * The same rule the harness follows, and for the same reason: a check that a
 * field ends up holding `2026-01-01` is this suite's business, and the spelling
 * the model library writes that down in is the library's. `readValueNode` is the
 * classifier the library uses when it parses an instance, so what it returns is
 * the answer — a literal has a value, a controlled term has an IRI and a label.
 *
 * The reads happen on this side rather than inside `page.evaluate`: the browser
 * has only the bundle, so a spec returns the node from the page and asks the
 * library about it here.
 */
import cedar from 'cedar-model-typescript-library';
import type { JsonNode } from 'cedar-model-typescript-library';

const {
  CedarReaders,
  InstanceDataContainer,
  InstanceDataControlledAtom,
  InstanceDataStringAtom,
  InstanceDataTypedAtom,
  JsonTemplateInstanceReader,
} = cedar;

const atomOf = (node: unknown) => JsonTemplateInstanceReader.readValueNode(node as JsonNode | string | null);

/**
 * The literal a node holds.
 *
 * `undefined` when the node is not a literal at all, which is a different
 * outcome from a literal of `null` — an emptied field holds the second.
 */
export const literalOf = (node: unknown): string | null | undefined => {
  const atom = atomOf(node);
  return atom instanceof InstanceDataStringAtom || atom instanceof InstanceDataTypedAtom ? atom.value : undefined;
};

/** The literal a named field of an instance holds. */
export const valueOf = (instance: unknown, field: string): string | null | undefined =>
  literalOf((instance as Record<string, unknown>)?.[field]);

/** The two halves of a controlled term held by a named field. */
export const termOf = (
  instance: unknown,
  field: string,
): { iri: string | null | undefined; label: string | null | undefined } => {
  const atom = atomOf((instance as Record<string, unknown>)?.[field]);
  return atom instanceof InstanceDataControlledAtom
    ? { iri: atom.id, label: atom.label }
    : { iri: undefined, label: undefined };
};

/**
 * A node holding a literal, for the specs that hand CEE an edited instance.
 *
 * A host really does replace `instanceObject` with a document it changed, and
 * writing that change as `node['@value'] = 'Public'` put the serialization back
 * into the suite. The writer is the mirror of the reader above.
 */
export const literalNode = (value: string | null): Record<string, string | null> =>
  cedar.JsonTemplateInstanceWriter.writeValueNode(new InstanceDataStringAtom(value)) as Record<string, string | null>;

/**
 * Every element-occurrence IRI an instance carries, at any depth.
 *
 * Expected to be none, for an instance CEE built: it invents no identity for an
 * occurrence, so an `@id` here only ever arrives in a loaded instance. This proved
 * two editors on a page were minting under separate host-configured prefixes; with
 * nothing minted, what it proves is that neither adds one, which is the property the
 * per-editor prefix existed to keep apart. Read by parsing the instance rather than
 * by walking the document for a key: the library's reader is what knows where an
 * occurrence's identity lives.
 */
export const elementIrisOf = (document: unknown): string[] => {
  const parsed = CedarReaders.json()
    .getFebruary2024()
    .getTemplateInstanceReader()
    .readFromObject(document as JsonNode).instance;
  const collect = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.flatMap(collect);
    }
    if (value instanceof InstanceDataContainer) {
      return [value.id ?? '', ...Object.values(value.values).flatMap(collect)].filter(Boolean);
    }
    return [];
  };
  return Object.values(parsed.dataContainer.values).flatMap(collect);
};
