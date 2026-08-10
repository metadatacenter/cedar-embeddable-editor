/**
 * Read-only mode and empty-field hiding.
 *
 * CEE has two operating modes. The domain layer's share of read-only is
 * smaller than it looks — most of the effect is in the widgets — but it is not
 * nothing, and none of it was covered:
 *
 *   - `DataContext.setInputTemplate` skips building the quality report
 *     entirely when read-only.
 *   - `hideEmptyFields` is only honoured in read-only mode, and it runs at
 *     *parse* time, setting `component.hidden` from the loaded instance. That
 *     is real tree-shaping logic with a recursive element case and a two-hop
 *     lookup for attribute-value fields.
 *
 * Worth stating plainly, because it is easy to assume otherwise: read-only is
 * a presentation concern. The handlers do not enforce it. See the
 * characterization at the end.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { at } from '../src/nodes';
import { instanceWith as buildInstance, literalNode, literalOf, literalValue, heldValue } from '../src/values';
import { JsonSchema } from 'cedar-model-typescript-library';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');
const ATTRIBUTE_VALUE = kind('attribute-value');

/** Build an instance by driving the editor, so it is shaped exactly as CEE emits it. */
const instanceWith = (template: object, writes: Array<[string[], string]>) => {
  const d = new CeeDriver(template);
  for (const [path, value] of writes) d.setValue(path, TEXT, value);
  return d.metadata;
};

describe('read-only mode', () => {
  const template = () => buildTemplate({ name: 'ro', children: [{ kind: TEXT, name: 'a', required: true }] });

  /**
   * The report used to be skipped in read-only mode, on the reasoning that
   * nothing can be edited so validity is uninteresting. But read-only plus
   * `hideEmptyFields` is the viewer configuration, and it was the one path
   * where an instance reached the screen with no validation at any layer —
   * read-only also suppresses the widgets' own errors.
   */
  it('builds a quality report in read-only mode', () => {
    const driver = new CeeDriver(template(), { readOnlyMode: true });
    expect(driver.dataContext.dataQualityReport).not.toBeNull();
  });

  it('validates an injected instance in a viewer', () => {
    const bad = buildInstance(
      'https://repo.metadatacenter.org/templates/ro',
      { _a: literalValue('fine') },
      'https://example.org/i/1',
    );
    const viewer = new CeeDriver(template(), { readOnlyMode: true, hideEmptyFields: true, instance: bad });
    expect(viewer.dataContext.dataQualityReport).not.toBeNull();
    expect(viewer.qualityReport.isValid).toBe(true);
  });

  it('builds one in edit mode', () => {
    const driver = new CeeDriver(template());
    expect(driver.dataContext.dataQualityReport).not.toBeNull();
  });

  it('still parses the template into the same component tree', () => {
    const edit = new CeeDriver(template());
    const ro = new CeeDriver(template(), { readOnlyMode: true });
    expect(ro.representation.children.map((c: any) => c.name)).toEqual(
      edit.representation.children.map((c: any) => c.name),
    );
  });

  it('still builds the instance skeleton', () => {
    const ro = new CeeDriver(template(), { readOnlyMode: true });
    expect(ro.extract).toHaveProperty('_a');
  });

  /**
   * CHARACTERIZATION: the handlers do not enforce read-only.
   *
   * `changeValue` writes regardless; the flag is consumed by `CedarUIDirective`
   * and the templates (`*ngIf="!readOnlyMode"`), which is to say the widgets
   * simply never offer the edit. An embedder driving `HandlerContext` directly
   * — or any future non-widget caller — is not protected by setting the flag.
   *
   * Pinned rather than reported as a defect: it is a coherent design, just not
   * the one the flag's name suggests.
   */
  it('does not prevent a programmatic write', () => {
    const driver = new CeeDriver(template(), { readOnlyMode: true });
    driver.setValue(['_a'], TEXT, 'written anyway');

    expect(heldValue(driver.handlerContext.getDataObjectNodeByPath(['_a']))).toBe('written anyway');
    driver.expectNoErrors('write in read-only mode');
  });
});

describe('hideEmptyFields', () => {
  const twoFields = () =>
    buildTemplate({
      name: 'hef',
      children: [
        { kind: TEXT, name: 'filled' },
        { kind: TEXT, name: 'empty' },
      ],
    });

  it('is ignored unless read-only mode is also on', () => {
    // The wrapper only calls enableEmptyFieldHiding when readOnlyMode is
    // already set (wrapper lines 202-208); the driver mirrors that.
    const driver = new CeeDriver(twoFields(), { hideEmptyFields: true });
    expect(driver.handlerContext.hideEmptyFields).toBe(false);
  });

  it('is enabled when both flags are set', () => {
    const driver = new CeeDriver(twoFields(), { readOnlyMode: true, hideEmptyFields: true });
    expect(driver.handlerContext.hideEmptyFields).toBe(true);
  });

  it('hides nothing when there is no instance to judge emptiness against', () => {
    // The factory requires instanceExtractData before it will hide anything.
    const driver = new CeeDriver(twoFields(), { readOnlyMode: true, hideEmptyFields: true });
    expect(driver.findOrThrow(['_filled']).hidden).toBeFalsy();
    expect(driver.findOrThrow(['_empty']).hidden).toBeFalsy();
  });

  it('hides the empty field and keeps the filled one', () => {
    const instance = instanceWith(twoFields(), [[['_filled'], 'a value']]);
    const driver = new CeeDriver(twoFields(), { readOnlyMode: true, hideEmptyFields: true, instance });

    expect(driver.findOrThrow(['_filled']).hidden).toBe(false);
    expect(driver.findOrThrow(['_empty']).hidden).toBe(true);
  });

  it('hides nothing in edit mode, even with the same instance', () => {
    const instance = instanceWith(twoFields(), [[['_filled'], 'a value']]);
    const driver = new CeeDriver(twoFields(), { instance });

    expect(driver.findOrThrow(['_empty']).hidden).toBeFalsy();
  });

  describe('attribute-value fields', () => {
    const attributes = () =>
      buildTemplate({ name: 'hef_attributes', children: [{ kind: ATTRIBUTE_VALUE, name: 'attributes' }] });

    it('keeps a populated dynamic attribute visible', () => {
      const template = attributes();
      const seed = new CeeDriver(template);
      const component = seed.findOrThrow(['_attributes']);
      seed.handlerContext.addMultiInstance(component);
      seed.handlerContext.changeAttributeValue(component, 'colour', 'blue');

      const viewer = new CeeDriver(template, {
        readOnlyMode: true,
        hideEmptyFields: true,
        instance: seed.metadata,
      });

      expect(viewer.extract._attributes).toEqual(['colour']);
      expect(literalOf(viewer.extract.colour)).toBe('blue');
      expect(viewer.findOrThrow(['_attributes']).hidden).toBe(false);
    });

    it('hides an attribute-value field whose dynamic-key array is empty', () => {
      const template = attributes();
      const seed = new CeeDriver(template);
      expect(seed.extract._attributes).toEqual([]);

      const viewer = new CeeDriver(template, {
        readOnlyMode: true,
        hideEmptyFields: true,
        instance: seed.metadata,
      });

      expect(viewer.findOrThrow(['_attributes']).hidden).toBe(true);
    });
  });

  describe('elements', () => {
    const nested = () =>
      buildTemplate({
        name: 'hef_el',
        elements: [
          { name: 'has_data', children: [{ kind: TEXT, name: 'f' }] },
          { name: 'no_data', children: [{ kind: TEXT, name: 'f' }] },
        ],
      });

    it('hides an element whose children are all empty', () => {
      const instance = instanceWith(nested(), [[['_has_data', '_f'], 'something']]);
      const driver = new CeeDriver(nested(), { readOnlyMode: true, hideEmptyFields: true, instance });

      expect(driver.findOrThrow(['_has_data']).hidden).toBe(false);
      expect(driver.findOrThrow(['_no_data']).hidden).toBe(true);
    });

    it('keeps an element visible when any descendant has a value', () => {
      const deep = () =>
        buildTemplate({
          name: 'hef_deep',
          elements: [
            {
              name: 'outer',
              children: [],
              elements: [{ name: 'inner', children: [{ kind: TEXT, name: 'f' }] }],
            },
          ],
        });
      const instance = instanceWith(deep(), [[['_outer', '_inner', '_f'], 'deep value']]);
      const driver = new CeeDriver(deep(), { readOnlyMode: true, hideEmptyFields: true, instance });

      expect(driver.findOrThrow(['_outer']).hidden).toBe(false);
      expect(driver.findOrThrow(['_outer', '_inner']).hidden).toBe(false);
    });
  });
});

/**
 * REGRESSION: element visibility must not depend on sibling order.
 *
 * `hasNonEmptyChild` decides whether an element is hidden under
 * `hideEmptyFields`. Its element branch used to assign the recursive result
 * without stopping, so the last element child decided the outcome and
 * overwrote any earlier `true`. An element holding data was reported empty
 * whenever a later sibling element happened to be empty — and the section
 * silently disappeared from a read-only viewer. Nothing errored; the data was
 * simply not shown.
 *
 * Both branches now return on the first non-empty child. That is strictly
 * monotonic toward visible: the change only adds an early exit on `true`, so
 * it can never hide something that previously rendered.
 */
describe('element visibility is independent of sibling order', () => {
  /** An outer element with two element children; `dataIn` picks which holds the value. */
  const twoChildElements = (dataIn: 'first' | 'second') =>
    buildTemplate({
      name: `order_${dataIn}`,
      elements: [
        {
          name: 'outer',
          children: [],
          elements: [
            { name: 'a', children: [{ kind: TEXT, name: 'f' }] },
            { name: 'b', children: [{ kind: TEXT, name: 'f' }] },
          ],
        },
      ],
    });

  const hiddenWithDataIn = (dataIn: 'first' | 'second') => {
    const t = twoChildElements(dataIn);
    const path = ['_outer', dataIn === 'first' ? '_a' : '_b', '_f'];
    const instance = instanceWith(t, [[path, 'a real value']]);
    const driver = new CeeDriver(t, { readOnlyMode: true, hideEmptyFields: true, instance });
    // The value really is in the instance either way.
    expect(heldValue(driver.handlerContext.getDataObjectNodeByPath(path))).toBe('a real value');
    return driver.findOrThrow(['_outer']).hidden;
  };

  it.each(['first', 'second'] as const)('stays visible with the data in the %s sibling', (dataIn) => {
    expect(hiddenWithDataIn(dataIn)).toBe(false);
  });

  it('gives the same answer for both orderings', () => {
    expect(hiddenWithDataIn('first')).toBe(hiddenWithDataIn('second'));
  });

  /**
   * Three element children with the value in the middle: the old shape would
   * have let the trailing empty sibling win regardless of how many populated
   * ones preceded it.
   */
  it('stays visible with a populated sibling between two empty ones', () => {
    const t = buildTemplate({
      name: 'order_middle',
      elements: [
        {
          name: 'outer',
          children: [],
          elements: [
            { name: 'a', children: [{ kind: TEXT, name: 'f' }] },
            { name: 'b', children: [{ kind: TEXT, name: 'f' }] },
            { name: 'c', children: [{ kind: TEXT, name: 'f' }] },
          ],
        },
      ],
    });
    const instance = instanceWith(t, [[['_outer', '_b', '_f'], 'middle value']]);
    const driver = new CeeDriver(t, { readOnlyMode: true, hideEmptyFields: true, instance });

    expect(driver.findOrThrow(['_outer']).hidden).toBe(false);
    // The genuinely empty siblings are still hidden — the fix reveals the
    // parent, not everything under it.
    expect(driver.findOrThrow(['_outer', '_a']).hidden).toBe(true);
    expect(driver.findOrThrow(['_outer', '_b']).hidden).toBe(false);
    expect(driver.findOrThrow(['_outer', '_c']).hidden).toBe(true);
  });

  it('still hides an outer element when every descendant is empty', () => {
    // The fix must not make everything visible: with no data anywhere, the
    // whole subtree stays hidden.
    const t = twoChildElements('first');
    const instance = instanceWith(t, []);
    const driver = new CeeDriver(t, { readOnlyMode: true, hideEmptyFields: true, instance });

    expect(driver.findOrThrow(['_outer']).hidden).toBe(true);
    expect(driver.findOrThrow(['_outer', '_a']).hidden).toBe(true);
    expect(driver.findOrThrow(['_outer', '_b']).hidden).toBe(true);
  });

  it('is unaffected by a field sibling sitting after a populated element', () => {
    // Mixed children: the field branch could never cause this bug (its `else
    // if` only ever sets true), but the combination was untested.
    const t = buildTemplate({
      name: 'order_mixed',
      elements: [
        {
          name: 'outer',
          children: [{ kind: TEXT, name: 'trailing' }],
          elements: [{ name: 'a', children: [{ kind: TEXT, name: 'f' }] }],
        },
      ],
    });
    const instance = instanceWith(t, [[['_outer', '_a', '_f'], 'nested value']]);
    const driver = new CeeDriver(t, { readOnlyMode: true, hideEmptyFields: true, instance });

    expect(driver.findOrThrow(['_outer']).hidden).toBe(false);
  });
});
