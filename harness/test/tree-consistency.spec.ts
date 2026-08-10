/**
 * Element occurrences carry the IRI CEDAR requires of them.
 *
 * What is left of a file that was about two trees. CEE kept the instance twice —
 * the artifact with its envelope, and the same content with the envelope left
 * off — written to separately by every mutation, and they diverged three times
 * that were found. Twenty-four tests here asserted the two agreed after each
 * kind of edit. There is one tree now, and the view without the envelope is the
 * instance's own data container, so agreement is not something a test can
 * observe: it is the same object.
 *
 * The minting is CEE's, and still worth stating.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, JsonSchema, NumberType } from 'cedar-model-typescript-library';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

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

describe('the full tree still carries its @ids', () => {
  /**
   * The other half. Element occurrences in the *full* tree need an `@id` —
   * CEDAR requires one, and `roundtrip.spec.ts` covers what happens to it on the
   * way out. The fix must not take it from both trees.
   */
  it('every element occurrence has one', () => {
    const full = new CeeDriver(nested()).metadata;

    expect(full._single[JsonSchema.atId]).toBeTruthy();
    expect(full._multi).toHaveLength(2);
    for (const occurrence of full._multi) {
      expect(occurrence[JsonSchema.atId]).toBeTruthy();
    }
  });

  it('and they are distinct per occurrence', () => {
    const full = new CeeDriver(nested()).metadata;
    const ids = full._multi.map((o: Record<string, string>) => o[JsonSchema.atId]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
