/**
 * Reaching into an instance, through the model's own guards.
 *
 * A spec that wants the `@value` under `_top` is making two claims at once: that
 * `_top` is there, and that it is a container rather than a leaf. `InstanceNode`
 * is a union — a string, a number, a boolean, null, an object or a list — so
 * neither claim can be written as `instance['_top']['@value']`, and under
 * `strict` the compiler says so at every such site.
 *
 * The answer here is not to cast the claims away. It is to make them once,
 * checked, with the path in the failure: `at(instance, '_top', '@value')` throws
 * `no container at _top` rather than `Cannot read properties of undefined`, which
 * is the difference between a spec that reports what the instance looks like and
 * one that reports that it crashed.
 *
 * `isInstanceObject` and `isInstanceArray` come from CEE's own model, so these
 * navigate by exactly the rule production navigates by.
 */
import {
  InstanceArray,
  InstanceNode,
  InstanceObject,
  isInstanceArray,
  isInstanceObject,
} from '@cee/models/instance-node.model';

/** A key into a container, or an index into a list of occurrences. */
export type PathStep = string | number;

const pathLabel = (path: readonly PathStep[]): string => (path.length === 0 ? 'the root' : path.join(' > '));

/**
 * Walk `root` by key and index.
 *
 * Every step is checked: descending into a leaf, or into a key the container
 * does not have, throws naming how far it got. The result is still an
 * `InstanceNode`, because the last step is as unknown as any other — pass it to
 * `asObject`, `asArray` or a matcher that does the narrowing itself.
 */
export const at = (root: InstanceNode | null | undefined, ...path: PathStep[]): InstanceNode | null => {
  let node: InstanceNode | null = root ?? null;
  for (let i = 0; i < path.length; i++) {
    const step = path[i];
    const walked = path.slice(0, i);
    if (typeof step === 'number') {
      if (!isInstanceArray(node)) {
        throw new Error(`No list at ${pathLabel(walked)}, so [${step}] does not resolve.`);
      }
      if (step >= node.length) {
        throw new Error(
          `The list at ${pathLabel(walked)} holds ${node.length} occurrence(s), so [${step}] is past it.`,
        );
      }
      node = node[step];
      continue;
    }
    if (!isInstanceObject(node)) {
      throw new Error(`No container at ${pathLabel(walked)}, so "${step}" does not resolve.`);
    }
    if (!node.hasValue(step)) {
      throw new Error(
        `The container at ${pathLabel(walked)} has no "${step}". It holds: ${Object.keys(node.values).join(', ')}`,
      );
    }
    node = node.values[step] ?? null;
  }
  return node ?? null;
};

/** The container at `path`, or a failure saying what was there instead. */
export const objectAt = (root: InstanceNode | null | undefined, ...path: PathStep[]): InstanceObject => {
  const node = at(root, ...path);
  if (!isInstanceObject(node)) {
    throw new Error(`Expected a container at ${pathLabel(path)}, found ${JSON.stringify(node)}.`);
  }
  return node;
};

/** The occurrences at `path`, or a failure saying what was there instead. */
export const arrayAt = (root: InstanceNode | null | undefined, ...path: PathStep[]): InstanceArray => {
  const node = at(root, ...path);
  if (!isInstanceArray(node)) {
    throw new Error(`Expected a list at ${pathLabel(path)}, found ${JSON.stringify(node)}.`);
  }
  return node;
};

/**
 * The instance itself, when a spec is about to reach into it.
 *
 * `DataContext.instanceFullData` is null until a template or an instance has
 * been set, which every spec here has done by the time it looks — so the check
 * is a statement of that, not a branch either half of which is expected.
 */
export const present = (instance: InstanceObject | null, what = 'the instance'): InstanceObject => {
  if (instance === null) {
    throw new Error(`${what} is null: nothing has been loaded into this driver.`);
  }
  return instance;
};

/**
 * A component's occurrence info, asserted present.
 *
 * `getMultiInstanceInfoForComponent` answers null for a component the info tree
 * has no entry for — which, for a spec that has just located the component in
 * the tree CEE built, means the two disagree. That is a failure worth its own
 * sentence rather than a `TypeError` on `.currentCount`.
 */
export const infoOf = <T>(info: T | null, component: { name?: string } | null = null): T => {
  if (info === null) {
    throw new Error(`No multi-instance info for ${component?.name ?? 'this component'}.`);
  }
  return info;
};
