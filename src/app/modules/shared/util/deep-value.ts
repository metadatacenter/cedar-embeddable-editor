/**
 * Deep copy and deep comparison of the values CEE builds and compares: instance nodes, the data
 * containers that hold them, and the component trees a template becomes.
 *
 * These replace lodash's `cloneDeep` and `isEqual`, which cost the bundle 22 kB for two functions,
 * and keep the behaviour CEE relied on. A copy keeps every object's prototype, so a component, a
 * data container or an `ExactDecimal` stays an instance of its class. `deep-value.spec.ts` holds
 * both to lodash's result on generated values.
 */

/** A deep copy that keeps each object's prototype and own enumerable properties. */
export function deepClone<T>(value: T): T {
  const copies = new Map<object, unknown>();
  const copy = (node: unknown): unknown => {
    if (node === null || typeof node !== 'object') return node;
    const seen = copies.get(node);
    if (seen !== undefined) return seen;
    if (node instanceof Date) return new Date(node.getTime());
    if (Array.isArray(node)) {
      const items: unknown[] = [];
      copies.set(node, items);
      for (const item of node) items.push(copy(item));
      return items;
    }
    if (node instanceof Map) {
      const entries = new Map<unknown, unknown>();
      copies.set(node, entries);
      for (const [key, item] of node) entries.set(key, copy(item));
      return entries;
    }
    if (node instanceof Set) {
      const members = new Set<unknown>();
      copies.set(node, members);
      for (const item of node) members.add(copy(item));
      return members;
    }
    const object = Object.create(Object.getPrototypeOf(node)) as Record<PropertyKey, unknown>;
    copies.set(node, object);
    for (const key of Reflect.ownKeys(node)) {
      if (Object.getOwnPropertyDescriptor(node, key)?.enumerable) {
        object[key] = copy((node as Record<PropertyKey, unknown>)[key]);
      }
    }
    return object;
  };
  return copy(value) as T;
}

/**
 * Whether two values are deeply equal: the same scalars, arrays of equal items, and objects with the
 * same prototype and the same own enumerable keys holding equal values. `NaN` equals `NaN` and `0`
 * equals `-0`, as in lodash.
 */
export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right || (left !== left && right !== right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => deepEqual(item, right[index]))
    );
  }
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }
  if (left instanceof Map || right instanceof Map) {
    return (
      left instanceof Map &&
      right instanceof Map &&
      left.size === right.size &&
      [...left].every(([key, item]) => right.has(key) && deepEqual(item, right.get(key)))
    );
  }
  if (left instanceof Set || right instanceof Set) {
    return (
      left instanceof Set &&
      right instanceof Set &&
      left.size === right.size &&
      [...left].every((item) => right.has(item))
    );
  }
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every(
    (key) =>
      Object.hasOwn(right, key) &&
      deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  );
}
