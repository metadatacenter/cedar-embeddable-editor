/**
 * `deepClone` and `deepEqual` against the lodash functions they replace.
 *
 * Each run generates a value of the shapes CEE copies and compares: plain objects and arrays,
 * strings, numbers including `NaN` and `-0`, `null` and `undefined`, dates, maps, instances of a
 * class, and the model library's `ExactDecimal`. The copy must equal lodash's copy, keep every
 * prototype and share no object with its source. The comparison must agree with lodash's, both for
 * a value and its copy and for a value and a copy changed in one place. The generator is seeded.
 *
 * It runs in the harness, which keeps lodash as a test dependency of its own: CEE itself no longer
 * depends on it.
 */
import { describe, expect, it } from 'vitest';
import { cloneDeep, isEqual } from 'lodash-es';
import { ExactDecimal } from 'cedar-model-typescript-library';
import { deepClone, deepEqual } from '@cee/util/deep-value';

const RUNS = 500;

/** mulberry32: small, fast and the same everywhere. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Node {
  label = 'node';
  children: unknown[] = [];
  describe(): string {
    return this.label;
  }
}

function generate(next: () => number, depth = 0): unknown {
  const pick = Math.floor(next() * (depth > 3 ? 7 : 12));
  switch (pick) {
    case 0:
      return null;
    case 1:
      return undefined;
    case 2:
      return ['', 'a', 'value', '0'][Math.floor(next() * 4)];
    case 3:
      return [0, -0, 1.5, NaN, 42, -7][Math.floor(next() * 6)];
    case 4:
      return next() < 0.5;
    case 5:
      return new Date(Math.floor(next() * 1e12));
    case 6:
      return ExactDecimal.forValue(['0.10', '1e2', '3.000'][Math.floor(next() * 3)]);
    case 7:
    case 8:
      return Array.from({ length: Math.floor(next() * 4) }, () => generate(next, depth + 1));
    case 9: {
      const node = new Node();
      node.label = String(Math.floor(next() * 5));
      node.children = Array.from({ length: Math.floor(next() * 3) }, () => generate(next, depth + 1));
      return node;
    }
    case 10:
      return new Map(Array.from({ length: Math.floor(next() * 3) }, (_, i) => [`k${i}`, generate(next, depth + 1)]));
    default:
      return Object.fromEntries(
        Array.from({ length: Math.floor(next() * 4) }, (_, i) => [`p${i}`, generate(next, depth + 1)]),
      );
  }
}

/** A copy of `value` with one leaf replaced, or the value itself when it holds no leaf to change. */
function changed(value: unknown, next: () => number): unknown {
  const copy = cloneDeep(value);
  const containers: Array<Record<string, unknown> | unknown[]> = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      containers.push(node);
      node.forEach(walk);
    } else if (node instanceof Node) {
      containers.push(node as unknown as Record<string, unknown>);
      walk(node.children);
    } else if (node !== null && typeof node === 'object' && Object.getPrototypeOf(node) === Object.prototype) {
      containers.push(node as Record<string, unknown>);
      Object.values(node).forEach(walk);
    }
  };
  walk(copy);
  if (containers.length === 0) return copy;
  const target = containers[Math.floor(next() * containers.length)];
  if (Array.isArray(target)) target.push('added');
  else target['label' in target ? 'label' : 'extra'] = 'changed';
  return copy;
}

function shares(copy: unknown, source: unknown, seen = new Set<unknown>()): boolean {
  if (source === null || typeof source !== 'object' || seen.has(source)) return false;
  seen.add(source);
  if (copy === source) return true;
  const children = (node: unknown) =>
    node instanceof Map ? [...node.values()] : Array.isArray(node) ? node : Object.values(node as object);
  const sourceChildren = children(source);
  const copyChildren = children(copy);
  return sourceChildren.some((child, index) => shares(copyChildren[index], child, seen));
}

describe('deepClone', () => {
  it('copies as lodash copies, keeping prototypes and sharing nothing', () => {
    for (let run = 0; run < RUNS; run++) {
      const value = generate(random(run));
      const ours = deepClone(value);
      expect(isEqual(ours, cloneDeep(value)), `run ${run}`).toBe(true);
      expect(isEqual(ours, value), `run ${run}`).toBe(true);
      expect(shares(ours, value), `run ${run}`).toBe(false);
    }
  });

  it('keeps a class instance an instance of its class', () => {
    const node = new Node();
    const exact = ExactDecimal.forValue('12345678901234567890.25');
    node.children = [exact];
    const copy = deepClone(node);
    expect(copy).toBeInstanceOf(Node);
    expect(copy.describe()).toBe('node');
    expect(ExactDecimal.isExact(copy.children[0])).toBe(true);
    expect(copy.children[0]).not.toBe(exact);
    expect(String(copy.children[0])).toBe(String(exact));
  });
});

describe('deepEqual', () => {
  it('agrees with lodash on a value and its copy, and on a value and a changed copy', () => {
    for (let run = 0; run < RUNS; run++) {
      const next = random(run);
      const value = generate(next);
      const copy = cloneDeep(value);
      expect(deepEqual(value, copy), `run ${run}`).toBe(isEqual(value, copy));
      const other = changed(value, next);
      expect(deepEqual(value, other), `run ${run}`).toBe(isEqual(value, other));
    }
  });

  it('treats NaN as equal to itself and 0 as equal to -0, and distinguishes prototypes', () => {
    expect(deepEqual([NaN], [NaN])).toBe(true);
    expect(deepEqual({ a: 0 }, { a: -0 })).toBe(true);
    expect(deepEqual(new Node(), { label: 'node', children: [] })).toBe(false);
    expect(deepEqual({ a: undefined }, {})).toBe(false);
    expect(deepEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
  });
});

describe('deepClone and deepEqual on shapes the generator rarely builds', () => {
  it('copies a cycle as a cycle', () => {
    const node: Record<string, unknown> = { name: 'loop' };
    node['self'] = node;
    const copy = deepClone(node);
    expect(copy).not.toBe(node);
    expect(copy['self']).toBe(copy);
  });

  it('copies and compares sets, dates and maps by content', () => {
    const set = new Set(['a', 'b']);
    const copy = deepClone(set);
    expect(copy).not.toBe(set);
    expect(deepEqual(copy, set)).toBe(true);
    expect(deepEqual(new Set(['a']), new Set(['b']))).toBe(false);
    expect(deepEqual(new Set(['a']), ['a'])).toBe(false);
    expect(deepEqual(new Date(1), new Date(2))).toBe(false);
    expect(deepEqual(new Date(1), { getTime: 1 })).toBe(false);
    expect(deepEqual(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(false);
    expect(
      deepEqual(
        new Map([['a', 1]]),
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      ),
    ).toBe(false);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
    expect(deepEqual([1, 2], [1])).toBe(false);
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});
