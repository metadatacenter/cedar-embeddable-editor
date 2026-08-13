/**
 * Converting between what a clock face shows and what an hour *is*.
 *
 * CEDAR stores a time as `HH:mm:ss` on a 24-hour clock, always. The temporal
 * field records that 24-hour value and the storage codec writes it verbatim. The
 * 12-hour setting is a display choice: `_ui.inputTimeFormat` of `12h` means show
 * `2 PM`, not store `02`.
 *
 * So a time picker offering a 12-hour face has to convert in both directions, and
 * getting that wrong writes the wrong instant into somebody's metadata — silently,
 * because `14:30` and `02:30` are both perfectly well-formed. The conversion lives
 * here, apart from the component, so it can be tested as arithmetic rather than
 * through a rendered form.
 *
 * The two edge cases are the ones every 12-hour clock gets wrong: **midnight is
 * 12 AM, not 0 AM**, and **noon is 12 PM, not 0 PM**. Hour 0 displays as 12 AM and
 * hour 12 displays as 12 PM.
 */
export type Meridian = 'AM' | 'PM';

export class ClockTime {
  /** What the 12-hour face shows for a 24-hour hour: 0 → 12, 13 → 1, 12 → 12. */
  static toTwelveHour(hour24: number): { hour: number; meridian: Meridian } {
    const wrapped = ((hour24 % 24) + 24) % 24;
    const meridian: Meridian = wrapped < 12 ? 'AM' : 'PM';
    const hour = wrapped % 12 === 0 ? 12 : wrapped % 12;
    return { hour, meridian };
  }

  /** The 24-hour hour a 12-hour face means: 12 AM → 0, 12 PM → 12, 1 PM → 13. */
  static toTwentyFourHour(hour12: number, meridian: Meridian): number {
    const onTheFace = ((((hour12 - 1) % 12) + 12) % 12) + 1; // 1..12, tolerating 0 and 13
    const base = onTheFace % 12; // 12 → 0
    return meridian === 'PM' ? base + 12 : base;
  }

  /**
   * Keep a number inside a range, wrapping rather than clamping.
   *
   * Wrapping because these are clock fields: stepping 59 minutes up should give
   * 0, and typing 25 into an hour box should not silently become 23 — the user
   * meant 1 more often than they meant the maximum. `null` and anything
   * unparseable become the low end, which is what an emptied box means.
   */
  static wrap(value: number | null, min: number, max: number): number {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return min;
    }
    const span = max - min + 1;
    return min + ((((Math.trunc(value) - min) % span) + span) % span);
  }

  /**
   * A `Date` carrying the given wall-clock time.
   *
   * Built from `template`'s calendar date so a time edit never moves the day.
   * The widget above this only ever reads `getHours`/`getMinutes`/`getSeconds`
   * off it, but the date half is a separate control writing to the same stored
   * representation, and quietly rolling it over midnight would be a real bug.
   */
  static withTime(template: Date | null, hour: number, minute: number, second: number): Date {
    const base = template ? new Date(template.getTime()) : new Date();
    base.setHours(hour, minute, second, 0);
    return base;
  }
}
