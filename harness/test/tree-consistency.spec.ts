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
import { InstanceValueNode } from '@cee/util/instance-value-node';
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

/**
 * Every kind of mutation leaves the two trees agreeing.
 *
 * Each mutation used to be written to both trees by making the same call twice
 * with a different first argument — eleven pairs across two handlers. Forgetting
 * the second call was a one-line mistake nothing would catch, because the trees
 * are only compared when something is emitted; and the *difference* between them
 * was passed separately, from memory, at each site, which is how a freshly built
 * extract came to carry element `@id`s a loaded one never had.
 *
 * `DataContext.applyToBothTrees` makes it one call and hands each tree its own
 * building mode. That makes the mistake hard to write. These tests make it
 * detectable, which is the half that survives someone deciding to write it
 * anyway.
 */
describe('a mutation reaches both trees', () => {
  /**
   * The full tree is the extract plus the envelope, so agreement means: strip
   * what belongs to the envelope from the full copy and the two are identical.
   */
  const ENVELOPE_KEYS = [
    '@context',
    '@id',
    '@type',
    'oslc:modifiedBy',
    'pav:createdOn',
    'pav:lastUpdatedOn',
    'pav:createdBy',
    'schema:isBasedOn',
    'schema:name',
    'schema:description',
  ];

  const withoutEnvelope = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map(withoutEnvelope);
    }
    if (node === null || typeof node !== 'object') {
      return node;
    }
    const entries = Object.entries(node as Record<string, unknown>).filter(([key]) => !ENVELOPE_KEYS.includes(key));
    // A value node keeps its own keys; only containers carry the envelope. The
    // distinction falls out of the key names, so nothing here has to know it.
    return Object.fromEntries(entries.map(([key, value]) => [key, withoutEnvelope(value)]));
  };

  /**
   * Every envelope key found anywhere in a tree, with the path to it.
   *
   * Only *containers* carry the envelope. A value node's keys are the value: a
   * controlled term is `{@id, rdfs:label}`, so an `@id` there is the term's IRI
   * and belongs in both trees, and a numeric value's `@type` is its XSD type.
   * `InstanceValueNode.isValue` is the one place that distinction is decided —
   * the same call the deserializer and the quality report make — so this asks it
   * rather than guessing from key names, which is what got the first version of
   * this check wrong.
   */
  const envelopeKeysIn = (node: unknown, path = ''): string[] => {
    if (Array.isArray(node)) {
      return node.flatMap((item, i) => envelopeKeysIn(item, `${path}[${i}]`));
    }
    if (node === null || typeof node !== 'object') {
      return [];
    }
    if (InstanceValueNode.isValue(node)) {
      return [];
    }
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      (ENVELOPE_KEYS.includes(key) ? [`${path}/${key}`] : []).concat(envelopeKeysIn(value, `${path}/${key}`)),
    );
  };

  const expectAgreement = (driver: CeeDriver, what: string): void => {
    // Two independent checks, because either alone can be satisfied by the wrong
    // thing.
    //
    // Comparing the trees with the envelope stripped catches a *missed* write —
    // one tree left behind. It cannot catch a write that put the envelope into
    // the extract, because stripping hides that on both sides.
    expect(withoutEnvelope(driver.extract), `the trees disagree after ${what}`).toEqual(
      withoutEnvelope(driver.metadata),
    );
    // So the extract's defining property is asserted directly: it carries no
    // envelope, anywhere, ever. That is what catches an occurrence added with the
    // full tree's building mode — which is a mistake that would otherwise show up
    // only in a document somebody saved.
    expect(envelopeKeysIn(driver.extract), `the extract carries envelope keys after ${what}`).toEqual([]);
  };

  it('after a value write', () => {
    const driver = new CeeDriver(nested());
    driver.setValue(['_top'], TEXT, 'written');
    expectAgreement(driver, 'a value write');
  });

  it('after a value write inside an element', () => {
    const driver = new CeeDriver(nested());
    driver.setValue(['_single', '_inner'], TEXT, 'written');
    expectAgreement(driver, 'a nested value write');
  });

  it('after a value write inside a multi element', () => {
    const driver = new CeeDriver(nested());
    driver.setValue(['_multi', '_deep'], TEXT, 'written');
    expectAgreement(driver, 'a value write in a multi element');
  });

  it('after clearing a value', () => {
    const driver = new CeeDriver(nested());
    driver.setValue(['_top'], TEXT, 'written');
    driver.handlerContext.changeValue(driver.findOrThrow(['_top']), null);
    expectAgreement(driver, 'clearing a value');
  });

  it('after a list write', () => {
    const driver = new CeeDriver(nested());
    driver.handlerContext.changeListValue(driver.findOrThrow(['_many']), ['one', 'two']);
    expectAgreement(driver, 'a list write');
  });

  it('after adding a multi-element occurrence', () => {
    const driver = new CeeDriver(nested());
    driver.handlerContext.addMultiInstance(driver.findOrThrow(['_multi']));
    expectAgreement(driver, 'adding an occurrence');
  });

  it('after copying a multi-element occurrence', () => {
    const driver = new CeeDriver(nested());
    driver.setValue(['_multi', '_deep'], TEXT, 'to be copied');
    driver.handlerContext.copyMultiInstance(driver.findOrThrow(['_multi']));
    expectAgreement(driver, 'copying an occurrence');
  });

  it('after deleting a multi-element occurrence', () => {
    const driver = new CeeDriver(nested());
    driver.handlerContext.deleteMultiInstance(driver.findOrThrow(['_multi']));
    expectAgreement(driver, 'deleting an occurrence');
  });

  it('after adding a multi-field occurrence', () => {
    const driver = new CeeDriver(nested());
    driver.handlerContext.addMultiInstance(driver.findOrThrow(['_many']));
    expectAgreement(driver, 'adding a field occurrence');
  });

  it('after a controlled-term write', () => {
    const driver = new CeeDriver(nested());
    driver.handlerContext.changeControlledValue(driver.findOrThrow(['_top']), 'https://x/1', 'One');
    expectAgreement(driver, 'a controlled-term write');
  });

  /**
   * A long-ish sequence, because the failure mode this is guarding is a *missed*
   * write: one tree drifting behind the other over several operations rather
   * than differing on one.
   */
  it('after a sequence of them', () => {
    const driver = new CeeDriver(nested());
    const multi = driver.findOrThrow(['_multi']);

    driver.setValue(['_top'], TEXT, 'first');
    driver.handlerContext.addMultiInstance(multi);
    driver.handlerContext.setCurrentIndex(multi, 1);
    driver.setValue(['_multi', '_deep'], TEXT, 'second');
    driver.handlerContext.copyMultiInstance(multi);
    driver.handlerContext.changeListValue(driver.findOrThrow(['_many']), ['a', 'b', 'c']);
    driver.handlerContext.setCurrentIndex(multi, 0);
    driver.setValue(['_multi', '_deep'], TEXT, 'third');
    driver.handlerContext.deleteMultiInstance(multi);

    expectAgreement(driver, 'a sequence of mutations');
  });
});
