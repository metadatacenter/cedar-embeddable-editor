/**
 * One instance tree, and the view derived from it.
 *
 * CEE used to keep the instance twice: `instanceFullData`, the artifact with its
 * envelope, and `instanceExtractData`, the same content with the envelope left
 * off at every depth. Two trees, written to separately by every mutation, and
 * they diverged — three times, that were found:
 *
 * - `addRandomAtId` ignored the building mode, so a freshly built extract carried
 *   element `@id`s that a loaded one never had;
 * - the builder left a numeric value's `@type` off the extract while the reader
 *   put it on, which the fixture here missed because it had no numeric field;
 * - and each divergence was invisible until something was emitted, because that
 *   was the only moment the two were compared.
 *
 * The second tree turned out not to be needed at all. Everything that reads an
 * instance navigates by *component path* — and no envelope key is a component
 * name — or goes through the model library's parsed container, which excludes the
 * envelope by construction. So it is now a derived view, computed by the same
 * library code that produces one at the read boundary, and there is one tree.
 *
 * These tests hold that: the view tracks the tree, and a mutation cannot leave it
 * stale.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, NumberType } from 'cedar-model-typescript-library';
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

/**
 * A numeric field, because a numeric value carries its XSD type *alongside the
 * value* — and that is the one key which looks like envelope and is not.
 *
 * Its absence from this fixture is why an earlier version of these tests missed
 * a third fresh-versus-loaded divergence: the builder left `@type` off the
 * envelope-free copy while the reader put it on, and with only text fields here
 * nothing noticed.
 */
const NUMERIC = {
  key: 'numeric',
  inputType: 'numeric',
  make: () => CedarBuilders.numericFieldBuilder(),
  isStatic: false,
  write: 'value',
  sample: '42',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configure: (b: unknown) => (b as any).withNumberType(NumberType.DECIMAL),
} as unknown as FieldKind;

/** Nesting worth checking: a single element, a multi element, a multi field. */
const nested = () =>
  buildTemplate({
    name: 'tc_nested',
    children: [
      { kind: TEXT, name: 'top' },
      { kind: NUMERIC, name: 'count' },
      { kind: TEXT, name: 'many', cardinality: 'multi', minItems: 2, maxItems: 5 },
    ],
    elements: [
      { name: 'single', children: [{ kind: TEXT, name: 'inner' }] },
      { name: 'multi', cardinality: 'multi', minItems: 2, maxItems: 4, children: [{ kind: TEXT, name: 'deep' }] },
    ],
  });

describe('a fresh instance and a loaded one have the same shape', () => {
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
 * Every kind of mutation leaves the view agreeing with the tree.
 *
 * `DataContext.applyToBothTrees` makes it one call and hands each tree its own
 * building mode. That makes the mistake hard to write. These tests make it
 * detectable, which is the half that survives someone deciding to write it
 * anyway.
 */
describe('the derived view tracks the tree', () => {
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

  it('after a numeric write, whose value carries its own @type', () => {
    const driver = new CeeDriver(nested());
    driver.setValue(['_count'], NUMERIC, '42');
    expectAgreement(driver, 'a numeric write');
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

describe('the derived view cannot go stale', () => {
  /**
   * The one failure mode a single tree still allows: a write that does not go
   * through `DataContext.mutate`, leaving the cached view behind.
   *
   * Every production write does go through it — the widgets call
   * `handlerContext.changeValue` and friends, and every consumer of a resolved
   * node only reads. This is what would notice if that stopped being true.
   */
  it('reflects a value written after it was first read', () => {
    const driver = new CeeDriver(nested());

    const before = driver.dataContext.instanceExtractData;
    expect(before['_top']).toEqual({ '@value': null });

    driver.setValue(['_top'], TEXT, 'written after the first read');

    expect(driver.dataContext.instanceExtractData['_top']).toEqual({ '@value': 'written after the first read' });
  });

  it('reflects an occurrence added after it was first read', () => {
    const driver = new CeeDriver(nested());
    const multi = driver.findOrThrow(['_multi']);

    expect(driver.dataContext.instanceExtractData['_multi']).toHaveLength(2);
    driver.handlerContext.addMultiInstance(multi);

    expect(driver.dataContext.instanceExtractData['_multi']).toHaveLength(3);
  });

  it('reflects an occurrence deleted after it was first read', () => {
    const driver = new CeeDriver(nested());
    const multi = driver.findOrThrow(['_multi']);

    // `_multi` declares minItems 2, and deletion refuses to cross a lower bound
    // — so there has to be a third occurrence before one can go.
    driver.handlerContext.addMultiInstance(multi);
    expect(driver.dataContext.instanceExtractData['_multi']).toHaveLength(3);

    driver.handlerContext.deleteMultiInstance(multi);
    expect(driver.dataContext.instanceExtractData['_multi']).toHaveLength(2);
  });

  it('reflects a whole new instance being injected', () => {
    const first = new CeeDriver(nested());
    first.setValue(['_top'], TEXT, 'from the first');
    void first.dataContext.instanceExtractData;

    const second = new CeeDriver(nested(), { instance: first.metadata });
    expect(second.dataContext.instanceExtractData['_top']).toEqual({ '@value': 'from the first' });
  });

  /** And it is a view, not the tree: writing to it changes nothing. */
  it('is a projection, so writing to it does not reach the instance', () => {
    const driver = new CeeDriver(nested());
    const view = driver.dataContext.instanceExtractData as Record<string, Record<string, unknown>>;
    view['_top']['@value'] = 'written to the view';

    driver.dataContext.invalidateDerivedViews();
    expect(driver.dataContext.instanceExtractData['_top']).toEqual({ '@value': null });
    expect(driver.dataContext.instanceFullData['_top']).toEqual({ '@value': null });
  });
});

describe('the cached occurrence count agrees with the instance', () => {
  /**
   * The remaining copy of something the instance already knows.
   *
   * `MultiInstanceObjectInfo.currentCount` is how many occurrences a multi
   * component has — which is also `instance[path].length`. It is maintained
   * alongside the instance: incremented on add and copy, decremented on delete.
   * `currentIndex` beside it is genuinely UI state and belongs there; the count
   * is not.
   *
   * The two agree today. Nothing checked that, which is exactly where the extract
   * tree was before it diverged three times, so this checks it. A proper fix means
   * deriving the count from the instance, which needs the info tree to know its
   * own path — a bigger change than it looks, and recorded in the roadmap rather
   * than done here.
   */
  const counted = () =>
    buildTemplate({
      name: 'tc_counts',
      children: [{ kind: TEXT, name: 'manyValues', cardinality: 'multi', minItems: 2, maxItems: 6 }],
      elements: [
        { name: 'el', cardinality: 'multi', minItems: 2, maxItems: 6, children: [{ kind: TEXT, name: 'inner' }] },
      ],
    });

  const check = (driver: CeeDriver, path: string[], key: string, what: string): void => {
    const component = driver.findOrThrow(path);
    const cached = driver.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(component)
      .currentCount;
    const actual = (driver.dataContext.instanceFullData[key] as unknown[]).length;
    expect(cached, `${what}: cached count ${cached} but the instance holds ${actual}`).toBe(actual);
  };

  it.each([
    ['a multi element', ['_el'], '_el'],
    ['a multi field', ['_manyValues'], '_manyValues'],
  ])('%s: on a fresh instance', (what, path, key) => {
    check(new CeeDriver(counted()), path as string[], key as string, what as string);
  });

  it.each([
    ['a multi element', ['_el'], '_el'],
    ['a multi field', ['_manyValues'], '_manyValues'],
  ])('%s: after add, copy and delete', (what, path, key) => {
    const driver = new CeeDriver(counted());
    const component = driver.findOrThrow(path as string[]);

    driver.handlerContext.addMultiInstance(component);
    check(driver, path as string[], key as string, `${what} after add`);

    driver.handlerContext.copyMultiInstance(component);
    check(driver, path as string[], key as string, `${what} after copy`);

    driver.handlerContext.deleteMultiInstance(component);
    check(driver, path as string[], key as string, `${what} after delete`);
  });

  /**
   * The case worth singling out: at `minItems` the delete is refused, so the
   * count must *not* move. A decrement that ran anyway would leave the cache one
   * below the truth and the pager offering a page that does not exist.
   */
  it('does not move when a refused delete leaves the instance alone', () => {
    const driver = new CeeDriver(counted());
    const element = driver.findOrThrow(['_el']);

    driver.handlerContext.deleteMultiInstance(element);
    driver.handlerContext.deleteMultiInstance(element);

    check(driver, ['_el'], '_el', 'at minItems');
    expect((driver.dataContext.instanceFullData['_el'] as unknown[]).length).toBe(2);
  });

  it('agrees on an instance that was loaded rather than built', () => {
    const seed = new CeeDriver(counted());
    seed.handlerContext.addMultiInstance(seed.findOrThrow(['_el']));

    const loaded = new CeeDriver(counted(), { instance: seed.metadata });
    check(loaded, ['_el'], '_el', 'loaded');
    expect((loaded.dataContext.instanceFullData['_el'] as unknown[]).length).toBe(3);
  });
});
