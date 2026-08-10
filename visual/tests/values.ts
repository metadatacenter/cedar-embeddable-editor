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

const { CedarReaders, InstanceDataContainer, InstanceDataStringAtom, InstanceDataTypedAtom, JsonTemplateInstanceReader } =
  cedar;

const atomOf = (node: unknown) => JsonTemplateInstanceReader.readValueNode(node);

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

/**
 * A node holding a literal, for the specs that hand CEE an edited instance.
 *
 * A host really does replace `instanceObject` with a document it changed, and
 * writing that change as `node['@value'] = 'Public'` put the serialization back
 * into the suite. The writer is the mirror of the reader above.
 */
export const literalNode = (value: string | null): unknown =>
  cedar.JsonTemplateInstanceWriter.writeValueNode(new InstanceDataStringAtom(value));

/**
 * Every element-occurrence IRI an instance carries, at any depth.
 *
 * CEE mints one of these for each occurrence it builds, from the IRI prefix its
 * host configured, so they are what proves two editors on a page are not sharing
 * that configuration. Read by parsing the instance rather than by walking the
 * document for a key: the library's reader is what knows where an occurrence's
 * identity lives.
 */
export const elementIrisOf = (document: unknown): string[] => {
  const parsed = CedarReaders.json().getFebruary2024().getTemplateInstanceReader().readFromObject(document).instance;
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
