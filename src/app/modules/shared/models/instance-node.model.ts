/**
 * What a node in a CEDAR instance document is.
 *
 * Three shapes, and the code moves between them constantly: an element or a value
 * wrapper is an object, a multi-instance field is an array of occurrences, and a
 * `@value` holds a primitive. That is what a JSON document is, and until now the
 * type said none of it — `class InstanceExtractData extends Object {}`, empty, so
 * every read was an unchecked `any` and nothing could tell a leaf from a container.
 *
 * Written as a union rather than a class hierarchy because the values are plain
 * parsed JSON: they arrive from `JSON.parse` and from the model library, never
 * through a constructor here, so a class would be a claim the runtime does not
 * back. The union is the closest TypeScript gets to a sealed type — `typeof` and
 * `Array.isArray` narrow it, and `unreachableNode` below makes a match exhaustive.
 */
export type InstanceLeaf = string | number | boolean | null;

/** A container: an element, a value wrapper, or the instance root. */
export type InstanceObject = { [key: string]: InstanceNode };

/** The occurrences of a multi-instance field. */
export type InstanceArray = InstanceNode[];

export type InstanceNode = InstanceLeaf | InstanceObject | InstanceArray;

/**
 * The three guards. Order matters in the implementations, not at the call site:
 * `typeof null === 'object'` and an array is an object too, so both are excluded
 * explicitly rather than left to reading order.
 */
export function isInstanceObject(node: InstanceNode): node is InstanceObject {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

export function isInstanceArray(node: InstanceNode): node is InstanceArray {
  return Array.isArray(node);
}

export function isInstanceLeaf(node: InstanceNode): node is InstanceLeaf {
  return node === null || typeof node !== 'object';
}

/**
 * Exhaustiveness. Call it in the branch that should be impossible; if a shape is
 * ever added to `InstanceNode` without a matching branch, the argument stops being
 * `never` and this fails to compile at every incomplete match.
 *
 * It throws rather than returning, because reaching it means the value was not the
 * shape the type promised — which is a bug in whatever produced it, not something
 * to absorb.
 */
export function unreachableNode(node: never): never {
  throw new Error('Unhandled instance node shape: ' + JSON.stringify(node));
}

/**
 * Read a container's child, or `null` if this node is not a container.
 *
 * Most call sites want exactly this — walk into a node the caller believes is an
 * object — and writing the guard out at each of them would bury the intent. The
 * guard still happens; it happens once.
 */
export function childOf(node: InstanceNode, key: string | number): InstanceNode | null {
  if (isInstanceArray(node)) {
    return typeof key === 'number' ? node[key] ?? null : null;
  }
  if (isInstanceObject(node)) {
    return node[String(key)] ?? null;
  }
  return null;
}
