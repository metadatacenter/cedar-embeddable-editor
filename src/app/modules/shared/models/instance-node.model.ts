import { InstanceDataAtomType, InstanceDataContainer } from 'cedar-model-typescript-library';

/**
 * What a node in an instance is.
 *
 * The model library's, not CEE's. These were CEE's own union over parsed JSON —
 * an object, an array, or a primitive — because CEE's working tree *was* a CEDAR
 * JSON-LD document: the thing a host sent, mutated in place, and handed back. So
 * a container was `{[key: string]: InstanceNode}` and a field's value was
 * `{'@value': 'text'}`, and CEE had to assemble the envelope and the `@context`
 * itself to make the document valid.
 *
 * The tree is a `TemplateInstance` now. A container is an
 * `InstanceDataContainer`, a value is an atom, and how either is written down is
 * the library's business — asked once, at the edge, by a writer. The names are
 * kept because they say what the code means by them; only what they mean has
 * changed.
 */

/** A container: an element occurrence, or the instance root. */
export type InstanceObject = InstanceDataContainer;

/** The occurrences of a multi-instance field. */
export type InstanceArray = InstanceDataAtomType[];

/** Any node: a container, a list of them, or a value. */
export type InstanceNode = InstanceDataAtomType;

/**
 * The two guards.
 *
 * `instanceof` rather than a shape test. The nodes are the library's classes
 * now, so the question "is this a container" has an answer the runtime carries,
 * instead of being inferred from whether it looks like one — which is what the
 * old `typeof node === 'object' && !Array.isArray(node)` was doing, and why a
 * value wrapper and an element were indistinguishable to it.
 */
export function isInstanceObject(node: InstanceNode | null | undefined): node is InstanceObject {
  return node instanceof InstanceDataContainer;
}

export function isInstanceArray(node: InstanceNode | null | undefined): node is InstanceArray {
  return Array.isArray(node);
}

/**
 * Read a container's child, or `null` if this node is not a container.
 *
 * Most call sites want exactly this — walk into a node the caller believes is a
 * container — and writing the guard out at each of them would bury the intent.
 * The guard still happens; it happens once.
 */
export function childOf(node: InstanceNode | null | undefined, key: string | number): InstanceNode | null {
  if (isInstanceArray(node)) {
    return typeof key === 'number' ? node[key] ?? null : null;
  }
  if (isInstanceObject(node)) {
    return node.values[String(key)] ?? null;
  }
  return null;
}
