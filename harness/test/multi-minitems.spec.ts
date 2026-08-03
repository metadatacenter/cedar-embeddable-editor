/**
 * A fresh instance honours every field's `minItems`.
 *
 * A multi field declaring `minItems: n` must start with n slots, empty or not.
 * The builder does that — and then, for a field with choices, threw the result
 * away: it rebuilt the array from whichever choices are `selectedByDefault`,
 * and if none are, that is an empty array. A required checkbox group came out
 * as `[]` against a schema demanding at least one item, so the instance was
 * invalid the moment it was created and nothing the user could do in the form
 * would fix the count.
 *
 * The two branches now agree. A choice field with defaults starts with those
 * defaults; one without starts with the same empty slots any other multi field
 * gets.
 */
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

let seq = 0;
const kindOf = (inputType: string, make: () => unknown, configure?: (b: unknown) => unknown): FieldKind =>
  ({ key: `mi${seq++}`, inputType, make, isStatic: false, write: 'value', sample: 'x', configure }) as FieldKind;

/** A checkbox group whose options are all unselected — the shape that failed. */
const checkboxNoDefaults = () =>
  kindOf('checkbox', () => CedarBuilders.checkboxFieldBuilder(), (b: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b as any).addCheckboxOption('I have read & understood'),
  );

const listNoDefaults = () =>
  kindOf('list', () => CedarBuilders.multipleChoiceListFieldBuilder(), (b: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b as any).addListOption('Alpha').addListOption('Beta'),
  );

const TEXT = kindOf('textfield', () => CedarBuilders.textFieldBuilder());

const templateWith = (kind: FieldKind, minItems: number, nested = false) => {
  const child = { kind, name: 'f', cardinality: 'multi' as const, minItems, maxItems: 9 };
  return nested
    ? buildTemplate({ name: `mi_n_${kind.key}_${minItems}`, elements: [{ name: 'el', children: [child] }] })
    : buildTemplate({ name: `mi_${kind.key}_${minItems}`, children: [child] });
};

const slots = (kind: FieldKind, minItems: number, nested = false): unknown[] => {
  const extract = new CeeDriver(templateWith(kind, minItems, nested)).extract;
  return nested ? extract._el._f : extract._f;
};

describe('a multi choice field with no default selection', () => {
  /**
   * REGRESSION: the choices branch replaced the array the `minItems` loop had
   * just filled, so a field demanding one item got none.
   */
  it('still gets its minItems slots', () => {
    expect(slots(checkboxNoDefaults(), 1)).toHaveLength(1);
  });

  it('gets as many slots as minItems asks for', () => {
    expect(slots(checkboxNoDefaults(), 3)).toHaveLength(3);
  });

  it('holds empty slots, not fabricated selections', () => {
    expect(slots(checkboxNoDefaults(), 1)).toEqual([{ '@value': null }]);
  });

  it('applies to a list field too', () => {
    expect(slots(listNoDefaults(), 2)).toHaveLength(2);
  });

  /** The nested case is the one template 028 actually hits. */
  it('applies inside an element', () => {
    expect(slots(checkboxNoDefaults(), 1, true)).toHaveLength(1);
  });

  it('leaves minItems 0 empty, as before', () => {
    expect(slots(checkboxNoDefaults(), 0)).toEqual([]);
  });
});

describe('a multi choice field with defaults', () => {
  const withDefaults = () =>
    kindOf('checkbox', () => CedarBuilders.checkboxFieldBuilder(), (b: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b as any).addCheckboxOption('Alpha', true).addCheckboxOption('Beta').addCheckboxOption('Gamma', true),
    );

  it('starts with those defaults selected', () => {
    expect(slots(withDefaults(), 1)).toEqual([{ '@value': 'Alpha' }, { '@value': 'Gamma' }]);
  });

  /**
   * Defaults already exceed `minItems` here, so nothing is padded — the point
   * being that the fix must not add empty slots alongside real selections.
   */
  it('does not pad when the defaults already satisfy minItems', () => {
    expect(slots(withDefaults(), 2)).toHaveLength(2);
  });

  it('pads when the defaults fall short of minItems', () => {
    expect(slots(withDefaults(), 4)).toEqual([
      { '@value': 'Alpha' },
      { '@value': 'Gamma' },
      { '@value': null },
      { '@value': null },
    ]);
  });
});

describe('a plain multi field is unaffected', () => {
  it('still gets its minItems slots', () => {
    expect(slots(TEXT, 2)).toEqual([{ '@value': null }, { '@value': null }]);
  });
});

describe('the instance validates against its own template', () => {
  const validates = (template: object): { valid: boolean; errors: string } => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ajv = new (Ajv as any)({ strict: false, allErrors: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addFormats(ajv as any);
    const check = ajv.compile(template);
    const emitted = InstanceSerializer.toJson(new CeeDriver(template).dataContext.instanceFullData);
    const valid = check(emitted);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { valid, errors: (check.errors ?? []).map((e: any) => `${e.instancePath} ${e.message}`).join('; ') };
  };

  it('for a required checkbox group with no defaults', () => {
    const outcome = validates(templateWith(checkboxNoDefaults(), 1));
    expect(outcome.valid, outcome.errors).toBe(true);
  });

  it('for the same field nested in an element', () => {
    const outcome = validates(templateWith(checkboxNoDefaults(), 1, true));
    expect(outcome.valid, outcome.errors).toBe(true);
  });
});
