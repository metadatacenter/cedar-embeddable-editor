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

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');

/** Build an instance by driving the editor, so it is shaped exactly as CEE emits it. */
const instanceWith = (template: object, writes: Array<[string[], string]>) => {
  const d = new CeeDriver(template);
  for (const [path, value] of writes) d.setValue(path, TEXT, value);
  return d.metadata;
};

describe('read-only mode', () => {
  const template = () =>
    buildTemplate({ name: 'ro', children: [{ kind: TEXT, name: 'a', required: true }] });

  it('does not build a quality report at template load', () => {
    // setInputTemplate guards buildQualityReport behind `!readOnlyMode`
    // (data-context.ts:56). Nothing to validate when nothing can be edited.
    const driver = new CeeDriver(template(), { readOnlyMode: true });
    expect(driver.dataContext.dataQualityReport).toBeNull();
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

    expect(driver.handlerContext.getDataObjectNodeByPath(['_a'])['@value']).toBe('written anyway');
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
 * Behaviour that looks wrong, pinned so a fix is a deliberate, visible change.
 */
describe('known defects (characterized, not endorsed)', () => {
  /**
   * DEFECT: element visibility depends on the order of its element children.
   *
   * `hasNonEmptyChild` (template-representation.factory.ts) loops a component's
   * children with two branches. The field branch is right:
   *
   *     } else if (this.getValueByPath(child.path, instanceExtractData)) {
   *       hasNonEmptyChild = true;
   *       break;
   *
   * The element branch assigns without breaking:
   *
   *     if (child instanceof MultiElementComponent || child instanceof SingleElementComponent) {
   *       hasNonEmptyChild = this.hasNonEmptyChild(child, handlerContext);
   *
   * so each element child overwrites the previous verdict and the **last one
   * wins**. An element that genuinely contains data is reported empty whenever
   * a later sibling element happens to be empty.
   *
   * The consequence is user-facing and silent: in read-only mode with
   * `hideEmptyFields`, a populated section disappears from the viewer. Nothing
   * errors — the data is simply not shown.
   *
   * Fix is one line — `if (this.hasNonEmptyChild(child, handlerContext)) { hasNonEmptyChild = true; break; }`
   * — but it changes what a viewer displays, so it is a deliberate change, not
   * a silent one.
   */
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
    expect(driver.handlerContext.getDataObjectNodeByPath(path)['@value']).toBe('a real value');
    return driver.findOrThrow(['_outer']).hidden;
  };

  it('hides a populated element when the empty sibling comes last', () => {
    expect(hiddenWithDataIn('first')).toBe(true);
  });

  it('shows the same content when the populated sibling comes last', () => {
    expect(hiddenWithDataIn('second')).toBe(false);
  });

  it('is purely an ordering artefact — identical data, opposite outcomes', () => {
    expect(hiddenWithDataIn('first')).not.toBe(hiddenWithDataIn('second'));
  });
});
