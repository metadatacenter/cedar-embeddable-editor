/**
 * The arithmetic behind the time picker.
 *
 * CEDAR stores a time on a 24-hour clock always; `_ui.inputTimeFormat: 12h` only
 * changes what the field *shows*. A picker offering a 12-hour face therefore
 * converts in both directions, and a mistake there writes the wrong instant into
 * someone's metadata without anything looking wrong — `14:30` and `02:30` are
 * both well-formed times.
 *
 * Which is why this is a pure function with tests, rather than arithmetic buried
 * in a component and verified by looking at a screenshot.
 */
import { describe, expect, it } from 'vitest';
import { ClockTime, Meridian } from '@cee/util/clock-time';

describe('showing a 24-hour hour on a 12-hour face', () => {
  /**
   * The two cases every 12-hour clock gets wrong: midnight is 12 AM, not 0 AM,
   * and noon is 12 PM, not 0 PM.
   */
  it.each([
    [0, 12, 'AM'],
    [1, 1, 'AM'],
    [11, 11, 'AM'],
    [12, 12, 'PM'],
    [13, 1, 'PM'],
    [23, 11, 'PM'],
  ])('hour %i shows as %i %s', (hour24, expectedHour, expectedMeridian) => {
    expect(ClockTime.toTwelveHour(hour24)).toEqual({ hour: expectedHour, meridian: expectedMeridian });
  });

  it('never shows hour 0', () => {
    for (let hour = 0; hour < 24; hour++) {
      expect(ClockTime.toTwelveHour(hour).hour, `hour ${hour}`).toBeGreaterThanOrEqual(1);
      expect(ClockTime.toTwelveHour(hour).hour, `hour ${hour}`).toBeLessThanOrEqual(12);
    }
  });
});

describe('reading a 12-hour face back as an hour', () => {
  it.each([
    [12, 'AM', 0],
    [1, 'AM', 1],
    [11, 'AM', 11],
    [12, 'PM', 12],
    [1, 'PM', 13],
    [11, 'PM', 23],
  ])('%i %s means hour %i', (hour12, meridian, expected) => {
    expect(ClockTime.toTwentyFourHour(hour12, meridian as Meridian)).toBe(expected);
  });

  /**
   * The property that matters: a round trip through the face must not move the
   * time. This is the check that would have caught an off-by-twelve.
   */
  it('round-trips every hour of the day', () => {
    for (let hour = 0; hour < 24; hour++) {
      const { hour: shown, meridian } = ClockTime.toTwelveHour(hour);
      expect(ClockTime.toTwentyFourHour(shown, meridian), `hour ${hour}`).toBe(hour);
    }
  });
});

describe('wrapping a clock field', () => {
  /**
   * Wrapping rather than clamping, because these are clock fields: stepping past
   * 59 minutes means 0, and someone typing 25 into an hour box meant 1 far more
   * often than they meant 23.
   */
  it.each([
    [0, 0],
    [23, 23],
    [24, 0],
    [25, 1],
    [-1, 23],
    [-24, 0],
  ])('hour %i wraps to %i', (input, expected) => {
    expect(ClockTime.wrap(input, 0, 23)).toBe(expected);
  });

  it.each([
    [59, 59],
    [60, 0],
    [61, 1],
    [-1, 59],
  ])('minute %i wraps to %i', (input, expected) => {
    expect(ClockTime.wrap(input, 0, 59)).toBe(expected);
  });

  it.each([
    [12, 12],
    [13, 1],
    [0, 12],
  ])('a 12-hour face field: %i wraps to %i', (input, expected) => {
    expect(ClockTime.wrap(input, 1, 12)).toBe(expected);
  });

  it('treats an emptied box as the low end', () => {
    expect(ClockTime.wrap(null, 0, 23)).toBe(0);
    expect(ClockTime.wrap(NaN, 0, 59)).toBe(0);
    expect(ClockTime.wrap(undefined as never, 1, 12)).toBe(1);
  });

  it('truncates a fraction rather than rounding it', () => {
    expect(ClockTime.wrap(3.9, 0, 23)).toBe(3);
  });
});

describe('building the Date the widget stores', () => {
  /**
   * The date half of a datetime field is a separate control writing to the same
   * stored representation, so a time edit must not move the day. Rolling over
   * midnight because the time was applied to "today" would be a real bug and an
   * extremely quiet one.
   */
  it('keeps the calendar date it was given', () => {
    const template = new Date(2019, 6, 4, 9, 15, 0);
    const built = ClockTime.withTime(template, 23, 45, 30);

    expect(built.getFullYear()).toBe(2019);
    expect(built.getMonth()).toBe(6);
    expect(built.getDate()).toBe(4);
    expect([built.getHours(), built.getMinutes(), built.getSeconds()]).toEqual([23, 45, 30]);
  });

  it('does not mutate the template', () => {
    const template = new Date(2019, 6, 4, 9, 15, 0);
    ClockTime.withTime(template, 23, 45, 30);
    expect(template.getHours()).toBe(9);
  });

  it('zeroes the milliseconds, which CEDAR does not store', () => {
    const built = ClockTime.withTime(new Date(2019, 6, 4, 9, 15, 0, 123), 1, 2, 3);
    expect(built.getMilliseconds()).toBe(0);
  });

  it('falls back to today when given no template', () => {
    const built = ClockTime.withTime(null, 5, 6, 7);
    expect([built.getHours(), built.getMinutes(), built.getSeconds()]).toEqual([5, 6, 7]);
  });
});
