/**
 * What `getDataObjectNodeByPath` actually resolves to.
 *
 * A component path like `['_el', '_field']` does not identify a node in the
 * instance. It identifies one *per cursor position*: resolution walks through
 * each multi ancestor's `currentIndex`, so the same path returns a different
 * node depending on which pages the user has flipped to. Nothing in the
 * signature says so, and `HandlerContext` therefore depends on mutating the
 * cursor before reading data — an ordering requirement stated nowhere.
 *
 * The choice of occurrence is now a parameter — see `OccurrenceSelector`. The
 * cursor-reading behaviour is still what `getDataObjectNodeByPath` does, because
 * that is what the widgets and the pager want, but it is one named selector a
 * caller opts into rather than the only thing available. `getDataObjectNodeAt`
 * is the same walk with the cursor taken out.
 *
 * The tests below still characterise the cursor-dependent path, because it is
 * still the default and still what most callers use. The pure path is covered at
 * the bottom.
 *
 * Read together with `cardinality.spec.ts`, which covers the counters, and
 * `view-sync.spec.ts`, which covers pushing values back into widgets after a
 * page turn.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { at } from '../src/nodes';

const TEXT = {
  key: 'text',
  inputType: 'textfield',
  make: () => CedarBuilders.textFieldBuilder(),
  isStatic: false,
  write: 'value',
  sample: 'a value',
} as unknown as FieldKind;

/** A multi element with one field inside it. */
const multiElement = () =>
  buildTemplate({
    name: 'pr_multi_el',
    elements: [
      { name: 'el', cardinality: 'multi', minItems: 3, maxItems: 9, children: [{ kind: TEXT, name: 'inner' }] },
    ],
  });

/** A multi field at the top level. */
const multiField = () =>
  buildTemplate({
    name: 'pr_multi_field',
    children: [{ kind: TEXT, name: 'f', cardinality: 'multi', minItems: 3, maxItems: 9 }],
  });

describe('a path inside a multi element resolves through the cursor', () => {
  /**
   * The core fact. Three occurrences, three different values, one path — and
   * which value you get is a function of `currentIndex`, not of the path.
   */
  it('returns a different node per page', () => {
    const driver = new CeeDriver(multiElement());
    const element = driver.findOrThrow(['_el']);

    for (const index of [0, 1, 2]) {
      driver.handlerContext.setCurrentIndex(element, index);
      driver.setValue(['_el', '_inner'], TEXT, `value ${index}`);
    }

    const seen: unknown[] = [];
    for (const index of [0, 1, 2]) {
      driver.handlerContext.setCurrentIndex(element, index);
      seen.push(driver.handlerContext.getDataObjectNodeByPath(['_el', '_inner']));
    }

    expect(seen).toEqual([{ '@value': 'value 0' }, { '@value': 'value 1' }, { '@value': 'value 2' }]);
  });

  /**
   * The consequence for a caller: two reads of the same path, with nothing but
   * a cursor move between them, disagree. Every consumer of this method is
   * therefore order-dependent whether it knows it or not.
   */
  it('so two reads of one path can disagree with no write between them', () => {
    const driver = new CeeDriver(multiElement());
    const element = driver.findOrThrow(['_el']);

    driver.handlerContext.setCurrentIndex(element, 0);
    driver.setValue(['_el', '_inner'], TEXT, 'first');

    const before = driver.handlerContext.getDataObjectNodeByPath(['_el', '_inner']);
    driver.handlerContext.setCurrentIndex(element, 1);
    const after = driver.handlerContext.getDataObjectNodeByPath(['_el', '_inner']);

    expect(before).toEqual({ '@value': 'first' });
    expect(after).not.toEqual(before);
  });

  /**
   * And it is the same object, not a copy — which is why the widgets can hold a
   * reference and mutate in place, and why any change here has to keep doing
   * that.
   */
  it('returns the live node, not a copy', () => {
    const driver = new CeeDriver(multiElement());
    const node = driver.handlerContext.getDataObjectNodeByPath(['_el', '_inner']) as Record<string, unknown>;
    node['@value'] = 'written through the reference';

    // Against the tree itself, not `driver.extract` — that is a derived view now,
    // so a write through a resolved node would not show up in a fresh copy of it.
    expect(at(driver.fullData, '_el', 0, '_inner', '@value')).toBe('written through the reference');
  });
});

describe('a multi field resolves to the whole list', () => {
  /**
   * Not through the cursor: a multi *field*'s path gives the array, and the
   * caller indexes it. Only multi *elements* consume the cursor during the
   * walk. Worth pinning because the asymmetry is invisible from the call site
   * and is exactly the sort of thing a purity refactor would flatten by
   * accident.
   */
  it('regardless of the current index', () => {
    const driver = new CeeDriver(multiField());
    const field = driver.findOrThrow(['_f']);

    driver.handlerContext.setCurrentIndex(field, 2);
    const atTwo = driver.handlerContext.getDataObjectNodeByPath(['_f']);
    driver.handlerContext.setCurrentIndex(field, 0);
    const atZero = driver.handlerContext.getDataObjectNodeByPath(['_f']);

    expect(Array.isArray(atZero)).toBe(true);
    expect(atZero).toBe(atTwo);
    expect(atZero).toHaveLength(3);
  });
});

describe('a path with no multi ancestor is already pure', () => {
  it('resolves the same node however the cursor has moved', () => {
    const driver = new CeeDriver(buildTemplate({ name: 'pr_flat', children: [{ kind: TEXT, name: 'f' }] }));
    const first = driver.handlerContext.getDataObjectNodeByPath(['_f']);
    const second = driver.handlerContext.getDataObjectNodeByPath(['_f']);

    expect(first).toBe(second);
  });
});

describe('nested multi elements consume one cursor each', () => {
  /**
   * Two levels means the path is a function of two cursors, and the pair has to
   * be set from the outside in — the inner element's info is reached *through*
   * the outer element's current occurrence, so moving the outer cursor changes
   * which inner cursor is even being read. This is the case that makes "just
   * pass an index" insufficient as a fix: what a caller needs to supply is a
   * path of indices, one per multi ancestor.
   */
  const twoDeep = () =>
    buildTemplate({
      name: 'pr_two_deep',
      elements: [
        {
          name: 'outer',
          cardinality: 'multi',
          minItems: 2,
          maxItems: 4,
          children: [{ kind: TEXT, name: 'label' }],
          elements: [
            { name: 'inner', cardinality: 'multi', minItems: 2, maxItems: 4, children: [{ kind: TEXT, name: 'deep' }] },
          ],
        },
      ],
    });

  it('resolves a distinct node for each combination', () => {
    const driver = new CeeDriver(twoDeep());
    const outer = driver.findOrThrow(['_outer']);

    const written: string[] = [];
    for (const o of [0, 1]) {
      driver.handlerContext.setCurrentIndex(outer, o);
      const inner = driver.findOrThrow(['_outer', '_inner']);
      for (const i of [0, 1]) {
        driver.handlerContext.setCurrentIndex(inner, i);
        const value = `o${o}i${i}`;
        driver.setValue(['_outer', '_inner', '_deep'], TEXT, value);
        written.push(value);
      }
    }

    const read: unknown[] = [];
    for (const o of [0, 1]) {
      driver.handlerContext.setCurrentIndex(outer, o);
      const inner = driver.findOrThrow(['_outer', '_inner']);
      for (const i of [0, 1]) {
        driver.handlerContext.setCurrentIndex(inner, i);
        read.push(driver.handlerContext.getDataObjectNodeByPath(['_outer', '_inner', '_deep']));
      }
    }

    expect(read).toEqual(written.map((v) => ({ '@value': v })));
  });

  /**
   * The count of cursors a path depends on is the count of multi ancestors,
   * which is what any pure replacement has to take as an argument.
   */
  it('depends on as many cursors as it has multi ancestors', () => {
    const driver = new CeeDriver(twoDeep());
    const outer = driver.findOrThrow(['_outer']);
    driver.handlerContext.setCurrentIndex(outer, 0);
    const innerAtOuterZero = driver.findOrThrow(['_outer', '_inner']);
    driver.handlerContext.setCurrentIndex(innerAtOuterZero, 1);
    const first = driver.handlerContext.getDataObjectNodeByPath(['_outer', '_inner', '_deep']);

    // Move only the outer cursor. The inner cursor for occurrence 1 is a
    // different counter, so the node changes even though nothing "inner" moved.
    driver.handlerContext.setCurrentIndex(outer, 1);
    const second = driver.handlerContext.getDataObjectNodeByPath(['_outer', '_inner', '_deep']);

    expect(second).not.toBe(first);
  });
});

describe('the parent lookup follows the same rule', () => {
  /**
   * `getParentDataObjectNodeByPath` is what the attribute-value widget and the
   * pager use, and it walks the same cursors — so it carries the same
   * order-dependence and must be changed with its sibling, not separately.
   */
  it('resolves the enclosing occurrence, per cursor', () => {
    const driver = new CeeDriver(multiElement());
    const element = driver.findOrThrow(['_el']);

    driver.handlerContext.setCurrentIndex(element, 0);
    const atZero = driver.handlerContext.getParentDataObjectNodeByPath(['_el', '_inner']);
    driver.handlerContext.setCurrentIndex(element, 2);
    const atTwo = driver.handlerContext.getParentDataObjectNodeByPath(['_el', '_inner']);

    expect(atZero).not.toBe(atTwo);
    expect(atZero).toBe(at(driver.fullData, '_el', 0));
    expect(atTwo).toBe(at(driver.fullData, '_el', 2));
  });
});

describe('resolving a specific occurrence, cursor ignored', () => {
  /**
   * The point of making the choice a parameter: a caller can name the occurrence
   * it means and get the same node however the user has since paged around.
   */
  const seeded = () => {
    const driver = new CeeDriver(multiElement());
    const element = driver.findOrThrow(['_el']);
    for (const index of [0, 1, 2]) {
      driver.handlerContext.setCurrentIndex(element, index);
      driver.setValue(['_el', '_inner'], TEXT, `value ${index}`);
    }
    return { driver, element };
  };

  it('returns the named occurrence, not the current one', () => {
    const { driver, element } = seeded();
    driver.handlerContext.setCurrentIndex(element, 2);

    expect(driver.handlerContext.getDataObjectNodeAt(['_el', '_inner'], [0])).toEqual({ '@value': 'value 0' });
    expect(driver.handlerContext.getDataObjectNodeAt(['_el', '_inner'], [1])).toEqual({ '@value': 'value 1' });
  });

  it('gives the same answer whatever the cursor is doing', () => {
    const { driver, element } = seeded();

    const answers = [0, 1, 2].map((cursor) => {
      driver.handlerContext.setCurrentIndex(element, cursor);
      return driver.handlerContext.getDataObjectNodeAt(['_el', '_inner'], [1]);
    });

    expect(answers[0]).toEqual({ '@value': 'value 1' });
    expect(answers[1]).toBe(answers[0]);
    expect(answers[2]).toBe(answers[0]);
  });

  it('still returns the live node, so a caller can write through it', () => {
    const { driver } = seeded();
    const node = driver.handlerContext.getDataObjectNodeAt(['_el', '_inner'], [2]) as Record<string, unknown>;
    node['@value'] = 'written directly';

    expect(at(driver.fullData, '_el', 2, '_inner', '@value')).toBe('written directly');
  });

  it('resolves nothing for an occurrence that does not exist', () => {
    const { driver } = seeded();
    expect(driver.handlerContext.getDataObjectNodeAt(['_el', '_inner'], [99])).toBeFalsy();
  });

  /**
   * With nesting, "which occurrence" is not one number. The indices are consumed
   * outermost-first, because an inner element's occurrences live inside the outer
   * element's chosen one.
   */
  it('takes one index per multi ancestor, outermost first', () => {
    const template = buildTemplate({
      name: 'pr_at_two_deep',
      elements: [
        {
          name: 'outer',
          cardinality: 'multi',
          minItems: 2,
          maxItems: 4,
          children: [{ kind: TEXT, name: 'label' }],
          elements: [
            { name: 'inner', cardinality: 'multi', minItems: 2, maxItems: 4, children: [{ kind: TEXT, name: 'deep' }] },
          ],
        },
      ],
    });
    const driver = new CeeDriver(template);
    const outer = driver.findOrThrow(['_outer']);

    for (const o of [0, 1]) {
      driver.handlerContext.setCurrentIndex(outer, o);
      const inner = driver.findOrThrow(['_outer', '_inner']);
      for (const i of [0, 1]) {
        driver.handlerContext.setCurrentIndex(inner, i);
        driver.setValue(['_outer', '_inner', '_deep'], TEXT, `o${o}i${i}`);
      }
    }

    // Park the cursors somewhere unrelated to what is being asked for.
    driver.handlerContext.setCurrentIndex(outer, 0);

    for (const o of [0, 1]) {
      for (const i of [0, 1]) {
        expect(
          driver.handlerContext.getDataObjectNodeAt(['_outer', '_inner', '_deep'], [o, i]),
          `occurrence [${o}, ${i}]`,
        ).toEqual({ '@value': `o${o}i${i}` });
      }
    }
  });

  it('the parent lookup takes the same indices', () => {
    const { driver, element } = seeded();
    driver.handlerContext.setCurrentIndex(element, 0);

    expect(driver.handlerContext.getParentDataObjectNodeAt(['_el', '_inner'], [2])).toBe(at(driver.fullData, '_el', 2));
  });
});

describe('the two selectors agree when the cursor is where you asked', () => {
  /**
   * The cursor-reading walk and the explicit walk are the same walk. If they
   * ever disagreed for the same occurrence, one of them would be wrong.
   */
  it('for every occurrence in turn', () => {
    const driver = new CeeDriver(multiElement());
    const element = driver.findOrThrow(['_el']);
    for (const index of [0, 1, 2]) {
      driver.handlerContext.setCurrentIndex(element, index);
      driver.setValue(['_el', '_inner'], TEXT, `value ${index}`);
    }

    for (const index of [0, 1, 2]) {
      driver.handlerContext.setCurrentIndex(element, index);
      expect(driver.handlerContext.getDataObjectNodeAt(['_el', '_inner'], [index])).toBe(
        driver.handlerContext.getDataObjectNodeByPath(['_el', '_inner']),
      );
    }
  });
});
