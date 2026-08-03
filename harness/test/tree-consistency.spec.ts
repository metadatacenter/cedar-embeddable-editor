/**
 * The two working trees, and the two ways of arriving at them.
 *
 * CEE keeps an `instanceFullData` — the whole artifact, envelope and all — and
 * an `instanceExtractData`, the same content with the envelope left off at every
 * depth. The extract is what the handlers, the quality report and path
 * resolution read.
 *
 * There are two paths to that pair: build it from a template, or read it from an
 * instance a host page injected. They have to produce the same shape for the
 * same content, and nothing made them — the builder minted an element `@id` into
 * *both* trees regardless of which it was filling, so a freshly built extract
 * carried `@id` on every element occurrence and a loaded one did not. Every
 * consumer of the extract therefore saw a different shape depending on how the
 * user got there.
 *
 * These tests compare the two paths directly. That is the property the roadmap's
 * "two instance trees, no single source of truth" is really about: not that
 * there are two trees, but that nothing checks they mean the same thing.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver, normalize } from '../src/driver';

const TEXT = {
  key: 'text',
  inputType: 'textfield',
  make: () => CedarBuilders.textFieldBuilder(),
  isStatic: false,
  write: 'value',
  sample: 'a value',
} as unknown as FieldKind;

/** Nesting worth checking: a single element, a multi element, a multi field. */
const nested = () =>
  buildTemplate({
    name: 'tc_nested',
    children: [{ kind: TEXT, name: 'top' }, { kind: TEXT, name: 'many', cardinality: 'multi', minItems: 2, maxItems: 5 }],
    elements: [
      { name: 'single', children: [{ kind: TEXT, name: 'inner' }] },
      { name: 'multi', cardinality: 'multi', minItems: 2, maxItems: 4, children: [{ kind: TEXT, name: 'deep' }] },
    ],
  });

describe('a built extract and a loaded extract have the same shape', () => {
  /**
   * REGRESSION: `addRandomAtId` ran for both trees whatever the building mode,
   * so the built extract carried an element `@id` the loaded one never had.
   */
  it('for a fresh instance round-tripped through the reader', () => {
    const fresh = new CeeDriver(nested());
    const loaded = new CeeDriver(nested(), { instance: fresh.metadata });

    expect(normalize(loaded.extract)).toEqual(normalize(fresh.extract));
  });

  it('with values in it', () => {
    const fresh = new CeeDriver(nested());
    fresh.setValue(['_top'], TEXT, 'top value');
    fresh.setValue(['_single', '_inner'], TEXT, 'inner value');
    fresh.setValue(['_multi', '_deep'], TEXT, 'deep value');

    const loaded = new CeeDriver(nested(), { instance: fresh.metadata });
    expect(normalize(loaded.extract)).toEqual(normalize(fresh.extract));
  });

  it('the built extract carries no element @id at any depth', () => {
    const extract = new CeeDriver(nested()).extract;
    const found: string[] = [];

    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((item, i) => walk(item, `${path}[${i}]`));
        return;
      }
      if (node === null || typeof node !== 'object') {
        return;
      }
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === '@id') {
          found.push(path || '<root>');
        }
        walk(value, `${path}/${key}`);
      }
    };
    walk(extract, '');

    expect(found, 'the extract is the tree with the envelope left off; @id is envelope').toEqual([]);
  });
});

describe('the full tree still carries its @ids', () => {
  /**
   * The other half. Element occurrences in the *full* tree need an `@id` —
   * CEDAR requires one, and `roundtrip.spec.ts` covers what happens to it on the
   * way out. The fix must not take it from both trees.
   */
  it('every element occurrence has one', () => {
    const full = new CeeDriver(nested()).metadata;

    expect(full._single['@id']).toBeTruthy();
    expect(full._multi).toHaveLength(2);
    for (const occurrence of full._multi) {
      expect(occurrence['@id']).toBeTruthy();
    }
  });

  it('and they are distinct per occurrence', () => {
    const full = new CeeDriver(nested()).metadata;
    const ids = full._multi.map((o: Record<string, string>) => o['@id']);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
