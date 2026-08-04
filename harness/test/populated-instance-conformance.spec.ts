/**
 * A *populated* instance validates against its template, for every field kind.
 *
 * `model-conformance.spec.ts` already validates CEE's output against the
 * template-as-JSON-Schema — the same check the Java validator runs. But it
 * validates the instance CEE builds from a freshly opened template, before any
 * value is written. That instance is the empty skeleton, and the skeleton is
 * not where instances break: a field's empty slot carries whatever the build
 * put there, so it conforms by construction. What the server actually rejects is
 * a *filled* field whose written value no longer matches the schema.
 *
 * That is exactly the hole a real defect fell through. Editing a temporal or
 * numeric field dropped the `@type` the value schema requires; the empty
 * skeleton still had it, so `model-conformance` stayed green while every saved
 * instance with a populated temporal field was rejected with a 400. This sweep
 * closes it: for each field kind, write a value the way a widget would, then
 * validate the emitted instance against its own template. It is generative
 * rather than corpus-bound, so it runs without the corpus and covers each kind
 * in isolation, and it drives the write path — the one the skeleton check skips.
 *
 * The `@type`-stripping cases at the end give the validator teeth: they prove it
 * rejects the precise shape the bug produced, so a regression cannot pass here.
 */
import { describe, expect, it } from 'vitest';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import { TemporalType, TemporalGranularity, NumberType } from 'cedar-model-typescript-library';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { buildTemplate } from '../src/generate';
import { FIELD_KINDS, type FieldKind } from '../src/axes';
import { CeeDriver } from '../src/driver';

/**
 * The same validator `model-conformance` uses: ajv in draft-04 mode with formats
 * registered, because a CEDAR template is a draft-04 schema and its value slots
 * declare `format: uri` / `date-time`. `strict: false` because the templates
 * carry keywords (CEDAR's own `_ui`, `_valueConstraints`) that are data, not
 * schema, and ajv would otherwise reject the document for them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeValidator = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ajv = new (Ajv as any)({ strict: false, allErrors: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addFormats(ajv as any);
  return ajv;
};

const errorsOf = (validate: { errors?: unknown[] | null }): string[] =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (validate.errors ?? []).map((e: any) => `${e.instancePath || '/'} ${e.message}`);

/**
 * Temporal and numeric only require an `@type` once they declare a type — a
 * bare `temporalFieldBuilder()` leaves it unset, so the schema would not require
 * the very property the regression drops. Configure them so the sweep exercises
 * the requirement rather than trivially passing without it.
 */
const configured: FieldKind[] = FIELD_KINDS.map((k) => {
  if (k.key === 'temporal') {
    return {
      ...k,
      sample: '2026-08-01T13:30:00-07:00',
      configure: (b: any) =>
        b.withTemporalType(TemporalType.DATETIME).withTemporalGranularity(TemporalGranularity.MINUTE).withTimezoneEnabled(true),
    };
  }
  if (k.key === 'numeric') {
    return { ...k, sample: '42', configure: (b: any) => b.withNumberType(NumberType.DECIMAL) };
  }
  return k;
});

/** Build a single-field template of this kind, write the sample, emit the instance and its template. */
const populate = (kind: FieldKind): { template: object; instance: Record<string, unknown> } => {
  const template = buildTemplate({ name: `s_${kind.key}`, children: [{ kind, name: 'f' }] });
  const driver = new CeeDriver(template);
  driver.setValue(['_f'], kind, kind.sample);
  driver.expectNoErrors(`write ${kind.key}`);
  return { template, instance: InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown> };
};

const populatable = configured.filter((k) => !k.isStatic && k.write !== 'none');

describe('a populated instance validates against its own template', () => {
  it('there is a field kind to populate for every non-static input', () => {
    // A guard on the sweep itself: if the axes grow an input the filter misses,
    // the count moves and this fails rather than the new kind going unchecked.
    expect(populatable.length).toBeGreaterThanOrEqual(20);
  });

  it.each(populatable.map((k) => [k.key, k] as const))('%s', (_key, kind) => {
    const { template, instance } = populate(kind);
    const validate = makeValidator().compile(template);
    expect(validate(instance), `${kind.key} instance rejected:\n  ${errorsOf(validate).join('\n  ')}`).toBe(true);
  });
});

describe('the validator rejects the shape the @type bug produced', () => {
  const stripType = (kind: FieldKind) => {
    const { template, instance } = populate(kind);
    const value = instance._f as Record<string, unknown>;
    delete value['@type']; // exactly what the pre-fix changeValue emitted
    const validate = makeValidator().compile(template);
    return { valid: validate(instance), errors: errorsOf(validate) };
  };

  it('a temporal value with no @type is invalid', () => {
    const { valid, errors } = stripType(configured.find((k) => k.key === 'temporal')!);
    expect(valid).toBe(false);
    expect(errors.join(' ')).toMatch(/@type/);
  });

  it('a numeric value with no @type is invalid', () => {
    const { valid, errors } = stripType(configured.find((k) => k.key === 'numeric')!);
    expect(valid).toBe(false);
    expect(errors.join(' ')).toMatch(/@type/);
  });
});
