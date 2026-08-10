/**
 * A field the template marks `_ui.hidden`.
 *
 * Hiding is a display decision. The template still declares the field, still
 * lists it in `properties`, and may still list it in `required` — so the
 * instance needs a slot for it whether or not anyone can see it. CEE dropped
 * such a child from the component tree entirely, which meant the instance
 * builder never learned about it, so the document came out missing a property
 * its own schema demanded. Three of the six non-conformant corpus templates
 * fail for exactly this reason.
 *
 * The fix keeps the child and marks it, rather than dropping it: the renderer
 * already skips a component whose `hidden` is set, so nothing needs to be shown
 * that should not be.
 */
import { describe, expect, it } from 'vitest';
import { DocumentKey } from '../src/document-keys';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const kind = (key: string, inputType: string, make: () => unknown, sample: string): FieldKind =>
  ({ key, inputType, make, isStatic: false, write: 'value', sample }) as FieldKind;

const TEXT = kind('text', 'textfield', () => CedarBuilders.textFieldBuilder(), 'visible text');

/** A template with one shown field and one hidden one. */
const withHidden = (opts: { required?: boolean; multi?: boolean } = {}) =>
  buildTemplate({
    name: `hf_${opts.required ? 'req' : 'opt'}_${opts.multi ? 'multi' : 'single'}`,
    children: [
      { kind: TEXT, name: 'shown' },
      {
        kind: TEXT,
        name: 'concealed',
        hidden: true,
        required: opts.required,
        cardinality: opts.multi ? 'multi' : undefined,
        minItems: opts.multi ? 1 : undefined,
        maxItems: opts.multi ? 4 : undefined,
      },
    ],
  });

describe('a hidden field stays in the document', () => {
  /**
   * REGRESSION: the property was absent altogether. A template listing it in
   * `required` could not produce a valid instance at all.
   */
  it('gets a slot in the instance', () => {
    const emitted = InstanceSerializer.toJson(new CeeDriver(withHidden()).instance) as Record<string, unknown>;
    expect(Object.keys(emitted)).toContain('_concealed');
  });

  it('gets a slot in the instance too', () => {
    expect(Object.keys(new CeeDriver(withHidden()).extract.values)).toContain('_concealed');
  });

  it('is in the @context, like any other property', () => {
    const emitted = InstanceSerializer.toJson(new CeeDriver(withHidden()).instance) as Record<
      string,
      Record<string, unknown>
    >;
    expect(Object.keys(emitted[DocumentKey.atContext])).toContain('_concealed');
  });

  it('a hidden multi field gets its list', () => {
    const extract = new CeeDriver(withHidden({ multi: true })).extract;
    expect(Array.isArray(extract.values._concealed)).toBe(true);
  });
});

describe('a hidden field is still not rendered', () => {
  /**
   * The other half, and the reason the fix is a flag rather than a removal:
   * the renderer skips a component whose `hidden` is set, so keeping the child
   * in the tree must not put it on screen.
   */
  it('is marked hidden on the component', () => {
    const driver = new CeeDriver(withHidden());
    expect(driver.findOrThrow(['_concealed']).hidden).toBe(true);
  });

  it('leaves a shown field alone', () => {
    const driver = new CeeDriver(withHidden());
    expect(driver.findOrThrow(['_shown']).hidden).toBeFalsy();
  });

  /**
   * `hideEmptyFields` writes the same flag, for a different reason. A field the
   * template hides must stay hidden when it happens to hold a value, and a
   * field hidden only because it is empty must reappear when it is filled —
   * so the two reasons cannot share one boolean without the display mode
   * unhiding what the template concealed.
   */
  it('stays hidden in read-only mode even when it holds a value', () => {
    const template = withHidden();
    const seed = new CeeDriver(template);
    seed.setValue(['_concealed'], TEXT, 'a value nobody should see');

    const driver = new CeeDriver(template, {
      instance: seed.metadata,
      readOnlyMode: true,
      hideEmptyFields: true,
    });
    driver.registryForVisibility();

    expect(driver.findOrThrow(['_concealed']).hidden).toBe(true);
  });

  it('a shown field holding a value is visible under hideEmptyFields', () => {
    const template = withHidden();
    const seed = new CeeDriver(template);
    seed.setValue(['_shown'], TEXT, 'visible');

    const driver = new CeeDriver(template, {
      instance: seed.metadata,
      readOnlyMode: true,
      hideEmptyFields: true,
    });
    driver.registryForVisibility();

    expect(driver.findOrThrow(['_shown']).hidden).toBe(false);
  });
});

describe('a required hidden field', () => {
  it('counts towards the required-field tally', () => {
    const report = new CeeDriver(withHidden({ required: true })).qualityReport;
    expect(report.requiredFieldValueCount).toBeGreaterThan(0);
  });
});
