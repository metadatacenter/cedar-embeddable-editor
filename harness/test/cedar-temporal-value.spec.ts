import { describe, expect, it } from 'vitest';
import {
  CedarTemporalConfiguration,
  CedarTemporalParts,
  CedarTemporalValue,
} from '@cee/util/cedar-temporal-value';
import { Temporal } from '@cee/models/temporal.model';
import { Xsd } from '@cee/models/xsd.model';

const config = (
  temporalType: string,
  granularity: string,
  timezoneEnabled = false,
): CedarTemporalConfiguration => ({ temporalType, granularity, timezoneEnabled });

const parts = (values: Partial<CedarTemporalParts>): CedarTemporalParts => ({
  ...CedarTemporalValue.empty(),
  ...values,
});

describe('the CEE temporal storage contract', () => {
  it.each([
    [Xsd.date, Temporal.year, '2026-08-09', '2026-01-01'],
    [Xsd.date, Temporal.month, '2026-08-09', '2026-08-01'],
    [Xsd.date, Temporal.day, '2026-08-09', '2026-08-09'],
    [Xsd.time, Temporal.hour, '21:45:32.125', '21:00:00'],
    [Xsd.time, Temporal.minute, '21:45:32.125', '21:45:00'],
    [Xsd.time, Temporal.second, '21:45:32.125', '21:45:32'],
    [Xsd.time, Temporal.decimalSecond, '21:45:32.001', '21:45:32.001'],
    [Xsd.dateTime, Temporal.year, '2026-08-09T21:45:32.125', '2026-01-01T00:00:00'],
    [Xsd.dateTime, Temporal.month, '2026-08-09T21:45:32.125', '2026-08-01T00:00:00'],
    [Xsd.dateTime, Temporal.day, '2026-08-09T21:45:32.125', '2026-08-09T00:00:00'],
    [Xsd.dateTime, Temporal.hour, '2026-08-09T21:45:32.125', '2026-08-09T21:00:00'],
    [Xsd.dateTime, Temporal.minute, '2026-08-09T21:45:32.125', '2026-08-09T21:45:00'],
    [Xsd.dateTime, Temporal.second, '2026-08-09T21:45:32.125', '2026-08-09T21:45:32'],
    [Xsd.dateTime, Temporal.decimalSecond, '2026-08-09T21:45:32.001', '2026-08-09T21:45:32.001'],
  ])('%s at %s granularity normalizes %s', (type, granularity, stored, expected) => {
    const configuration = config(type, granularity);
    const parsed = CedarTemporalValue.parse(stored, configuration);

    expect(parsed).not.toBeNull();
    expect(CedarTemporalValue.serialize(parsed!, configuration)).toBe(expected);
  });

  it('preserves fractional seconds as digits rather than converting them to a number', () => {
    const configuration = config(Xsd.time, Temporal.decimalSecond);

    for (const fraction of ['1', '01', '001', '100', '000001000']) {
      const stored = `12:30:45.${fraction}`;
      const parsed = CedarTemporalValue.parse(stored, configuration);
      expect(parsed?.fraction, stored).toBe(fraction);
      expect(CedarTemporalValue.serialize(parsed!, configuration), stored).toBe(stored);
    }
  });

  it('preserves an allowed offset while discarding finer time information', () => {
    const configuration = config(Xsd.dateTime, Temporal.day, true);
    const parsed = CedarTemporalValue.parse('2026-08-09T21:45:32.125-07:00', configuration);

    expect(CedarTemporalValue.serialize(parsed!, configuration)).toBe('2026-08-09T00:00:00-07:00');
  });

  it('drops an offset when the template does not enable one', () => {
    const configuration = config(Xsd.dateTime, Temporal.minute, false);
    const parsed = CedarTemporalValue.parse('2026-08-09T21:45:32-07:00', configuration);

    expect(CedarTemporalValue.serialize(parsed!, configuration)).toBe('2026-08-09T21:45:00');
  });

  it('keeps Z distinct from +00:00', () => {
    const configuration = config(Xsd.time, Temporal.second, true);

    for (const offset of ['Z', '+00:00']) {
      const stored = `12:30:45${offset}`;
      const parsed = CedarTemporalValue.parse(stored, configuration);
      expect(CedarTemporalValue.serialize(parsed!, configuration)).toBe(stored);
    }
  });

  it('pads parts supplied by the future segmented editor', () => {
    const configuration = config(Xsd.dateTime, Temporal.minute);
    const draft = parts({ year: '2026', month: '8', day: '9', hour: '7', minute: '5' });

    expect(CedarTemporalValue.serialize(draft, configuration)).toBe('2026-08-09T07:05:00');
  });

  it('does not serialize an incomplete visible value', () => {
    const configuration = config(Xsd.dateTime, Temporal.minute);
    const draft = parts({ year: '2026', month: '08', day: '09', hour: '21' });

    expect(CedarTemporalValue.serialize(draft, configuration)).toBeNull();
  });

  it.each([
    ['', Xsd.date, Temporal.day],
    ['not a date', Xsd.date, Temporal.day],
    ['2026-08', Xsd.date, Temporal.month],
    ['2026-08-09', Xsd.dateTime, Temporal.day],
    ['21:45', Xsd.dateTime, Temporal.minute],
    ['2026-08-09T21:45:00.1.2', Xsd.dateTime, Temporal.decimalSecond],
  ])('refuses malformed or structurally incompatible input %j', (stored, type, granularity) => {
    expect(CedarTemporalValue.parse(stored, config(type, granularity))).toBeNull();
  });
});
