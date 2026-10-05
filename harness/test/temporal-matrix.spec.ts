/**
 * The temporal storage contract against the validators, for every temporal configuration.
 *
 * Two pieces of CEE decide what a temporal value is. `CedarTemporalValue` reads a stored value
 * into parts and writes parts back at the field's granularity; the validators decide whether a
 * value is one the field accepts. Each is tested on its own, case by case. Nothing held them to
 * each other, and a disagreement between them is a value the editor rewrites although it was
 * valid, or writes although its own validators refuse it.
 *
 * So every configuration a template can declare — each temporal type at each granularity it
 * admits, with and without an offset — is crossed with a spread of stored values: each precision,
 * finer and coarser forms, leap days, impossible dates and times, and offsets valid and invalid.
 * The configuration is the one the widget reads off the parsed field, which enables an offset only
 * where the field records a time. Three claims are asserted for each configuration, and each lists
 * every value that breaks it:
 *
 * - a value the validators accept is read and written back unchanged, so loading never rewrites it,
 *   except that a time written without seconds gains them;
 * - a value valid at any granularity of its type, written at this one, is a value the validators
 *   accept here, so normalizing a stored value never produces one the field refuses;
 * - writing what was written changes nothing.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, TemporalGranularity, TemporalType } from 'cedar-model-typescript-library';
import { CedarValidators } from '@cee/validation/cedar-validators';
import { CedarTemporalConfiguration, CedarTemporalValue } from '@cee/util/cedar-temporal-value';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const GRANULARITIES: Record<string, TemporalGranularity[]> = {
  'xsd:date': [TemporalGranularity.YEAR, TemporalGranularity.MONTH, TemporalGranularity.DAY],
  'xsd:time': [
    TemporalGranularity.HOUR,
    TemporalGranularity.MINUTE,
    TemporalGranularity.SECOND,
    TemporalGranularity.DECIMAL_SECOND,
  ],
  'xsd:dateTime': TemporalGranularity.values(),
};
const TYPES = TemporalType.values();

const DATES = [
  '2026-08-09',
  '2026-01-01',
  '2026-08-01',
  '2024-02-29',
  '2025-02-29',
  '2026-13-01',
  '2026-00-10',
  '0001-01-01',
  '2026-8-9',
];
const TIMES = [
  '21:45:32.125',
  '21:45:32.001',
  '21:45:32',
  '21:45:00',
  '21:00:00',
  '00:00:00',
  '23:59:59',
  '24:00:00',
  '23:60:00',
  '21:45',
];
const OFFSETS = ['', 'Z', '+05:30', '-14:00', '+14:00', '+14:30', '+05:60'];
function candidates(type: string): string[] {
  const bases =
    type === 'xsd:date'
      ? DATES
      : type === 'xsd:time'
        ? TIMES
        : DATES.slice(0, 5).flatMap((date) => TIMES.map((time) => `${date}T${time}`));
  return bases.flatMap((base) => OFFSETS.map((offset) => base + offset));
}

type ValidatedControl = Parameters<ReturnType<typeof CedarValidators.forComponent>>[0];
let seq = 0;
/** The validator CEE puts on a field of this configuration, built from the field as CEE parses it. */
function validatorFor(type: TemporalType, granularity: TemporalGranularity, timezone: boolean) {
  const kind: FieldKind = {
    key: `t${seq++}`,
    inputType: 'temporal',
    make: () => CedarBuilders.temporalFieldBuilder(),
    isStatic: false,
    write: 'value',
    sample: 'x',
    configure: (b: any) => b.withTemporalType(type).withTemporalGranularity(granularity).withTimezoneEnabled(timezone),
  };
  const component = new CeeDriver(buildTemplate({ name: kind.key, children: [{ kind, name: 'f' }] })).findOrThrow([
    '_f',
  ]);
  const validate = CedarValidators.forComponent(component);
  // The widget's own configuration, read off the parsed field as the widget reads it.
  const configuration: CedarTemporalConfiguration = {
    temporalType: component.valueInfo.temporalType,
    granularity: component.basicInfo.temporalGranularity,
    timezoneEnabled: component.basicInfo.timezoneEnabled === true,
  };
  return {
    valid: (value: string): boolean => validate({ value } as unknown as ValidatedControl) === null,
    configuration,
  };
}

const configurations = TYPES.flatMap((type) =>
  GRANULARITIES[type.getValue()!].flatMap((granularity) =>
    [false, true].map((timezone) => ({ type, granularity, timezone })),
  ),
);
const named = configurations.map(
  (c) => [c.type.getValue(), c.granularity.getValue(), c.timezone ? 'with an offset' : 'without an offset', c] as const,
);

describe('temporal values against the validators', () => {
  it('covers each type at each granularity it admits, with and without an offset', () => {
    expect(configurations).toHaveLength((3 + 4 + 7) * 2);
  });

  it.each(named)('%s at %s %s', (_type, _granularity, _offset, { type, granularity, timezone }) => {
    const { valid, configuration } = validatorFor(type, granularity, timezone);
    // An offset means something only beside a time, so the model enables one only where the field records a time.
    const timed = ['hour', 'minute', 'second', 'decimalSecond'].includes(granularity.getValue()!);
    expect(configuration).toEqual({
      temporalType: type.getValue(),
      granularity: granularity.getValue(),
      timezoneEnabled: timezone && timed,
    });
    const write = (value: string) => {
      const parts = CedarTemporalValue.parse(value, configuration);
      return parts === null ? null : CedarTemporalValue.serialize(parts, configuration);
    };
    const values = candidates(configuration.temporalType!);

    // The validators accept a time without seconds at minute precision, which XSD's lexical form
    // does not; writing it completes the form with ":00", and that is the only rewrite allowed.
    const completed = (value: string) => value.replace(/(^|T)(\d{2}:\d{2})(?=$|Z|[+-])/, '$1$2:00');
    const rewritten = values.filter((value) => valid(value) && write(value) !== completed(value));
    expect(rewritten, 'valid values that loading rewrites').toEqual([]);

    // Values some granularity of this type accepts, as a stored value of an earlier template version may be.
    const others = GRANULARITIES[configuration.temporalType!].flatMap((other) =>
      [false, true].map((zone) => validatorFor(type, other, zone).valid),
    );
    const normalizedInvalid = values
      .filter((value) => others.some((validAtOther) => validAtOther(value)))
      .map((value) => [value, write(value)] as const)
      .filter(([, written]) => written !== null && !valid(written));
    expect(normalizedInvalid, 'valid values whose normalized form this field refuses').toEqual([]);

    const unsettled = values
      .map((value) => write(value))
      .filter((written): written is string => written !== null && write(written) !== written);
    expect(unsettled, 'written values that change when written again').toEqual([]);
  });
});
