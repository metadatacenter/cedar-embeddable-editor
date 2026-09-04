import { expect, test } from '@playwright/test';
import { valueOf } from './values';
import { open } from './support/host';

/**
 * CEE's own time picker.
 *
 * Written because `@angular-material-components/datetime-picker` peers Angular 16
 * and capped the upgrade, and because the obvious replacement supports no seconds
 * at all — while second-precision is the second most used granularity across both
 * artifact corpora, after `day`.
 *
 * Tested here rather than in the domain harness because it is a widget: what
 * matters is which boxes a granularity puts on screen and what a click on a
 * stepper stores. The arithmetic underneath has its own unit tests in
 * `harness/test/clock-time.spec.ts`.
 *
 * `09-temporal` is the fixture; before it existed the only temporal field under
 * test was minute-granularity, so the seconds boxes and the 12-hour face — the
 * entire reason for owning this — were rendered by nothing.
 */
test.describe('the time picker', () => {
  /**
   * Which picker belongs to which field, in document order.
   *
   * `year_only` and `day_only` are `xsd:date`, so they have no time half at all —
   * the six pickers are the six fields that do.
   */
  const PICKERS = [
    'hour_only',
    'to_the_minute',
    'to_the_second',
    'decimal_seconds',
    'twelve_hour',
    'twelve_hour_seconds',
  ];
  const pickerFor = (page: import('@playwright/test').Page, field: string) =>
    page.locator('.cee-time-picker').nth(PICKERS.indexOf(field));

  /** The instance CEE would hand a host page. */
  const storedValue = async (page: import('@playwright/test').Page, field: string): Promise<unknown> =>
    valueOf(await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.currentMetadata), field);

  /**
   * Which boxes each granularity offers, asserted per field.
   *
   * This is the model-fidelity claim, and the reason CEE owns this component: a
   * field never shows precision it cannot store, and never hides precision it
   * can. `@ng-matero/extensions` would have failed the last two rows outright.
   */
  test.describe('shows exactly the units its granularity allows', () => {
    const cases: Array<[string, number, number]> = [
      // field, minute boxes, second boxes — every time field has exactly one hour
      ['hour_only', 0, 0],
      ['to_the_minute', 1, 0],
      ['to_the_second', 1, 1],
      ['decimal_seconds', 1, 1],
      ['twelve_hour', 1, 0],
      ['twelve_hour_seconds', 1, 1],
    ];

    for (const [field, minutes, seconds] of cases) {
      test(field, async ({ page }) => {
        await open(page, '09-temporal');
        const picker = pickerFor(page, field);

        await expect(picker.locator('input[aria-label="Hour"]'), 'hour').toHaveCount(1);
        await expect(picker.locator('input[aria-label="Minute"]'), 'minute').toHaveCount(minutes);
        await expect(picker.locator('input[aria-label="Second"]'), 'second').toHaveCount(seconds);
      });
    }

    test('a date-only field has no time picker at all', async ({ page }) => {
      await open(page, '09-temporal');
      await expect(page.locator('.cee-time-picker')).toHaveCount(PICKERS.length);
    });
  });

  /**
   * Typing the first segment must not reflow the rest of a temporal row.
   *
   * The picker used to change every segment from a placeholder-sized width to
   * `2ch` as soon as any segment was valid. That narrowed the entire control and,
   * while the other segments were still empty, put `MM` and `SS` into boxes sized
   * for digits. The row visibly jumped and the placeholders clipped.
   */
  test('typing the first segment does not resize the clock', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_second');
    const shell = picker.locator('.cee-time-input-shell');
    const emptyWidth = await shell.evaluate((element) => element.getBoundingClientRect().width);

    await picker.locator('input[aria-label="Hour"]').fill('14');
    const partialWidth = await shell.evaluate((element) => element.getBoundingClientRect().width);

    expect(partialWidth, 'the clock moved the controls beside it').toBeCloseTo(emptyWidth, 1);

    const clipped = await picker
      .locator('input[placeholder="MM"], input[placeholder="SS"]')
      .evaluateAll((inputs: HTMLInputElement[]) => {
        const measure = document.createElement('canvas').getContext('2d')!;
        return inputs
          .map((input) => {
            const style = getComputedStyle(input);
            measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            return { placeholder: input.placeholder, available, needed: measure.measureText(input.placeholder).width };
          })
          .filter((segment) => segment.needed > segment.available)
          .map((segment) => `${segment.placeholder} needs ${segment.needed.toFixed(1)}px, has ${segment.available}px`);
      });
    expect(clipped, 'an unfilled segment is clipping its placeholder').toEqual([]);
  });

  /**
   * A temporal field is one row of controls, so they line up.
   *
   * The offset did not. Editable, it was the row's only control with a floating
   * label, and a floating label rests where Material's own 56px field puts it —
   * seven pixels below the date's text in the 48px CEE renders. Read-only it was
   * bare text, 36px tall and top-aligned against two 48px bordered boxes.
   *
   * Both are geometry rather than appearance, so both are measured. A clipped
   * screenshot of this row would carry the diff too, but it would not say which
   * of the three moved.
   */
  test.describe('a temporal row lines its controls up', () => {
    const boxes = (page: import('@playwright/test').Page, selectors: Record<string, string>) =>
      page
        .locator('app-cedar-input-datetime')
        .first()
        .evaluate((host, wanted) => {
          const out: Record<string, { top: number; height: number } | null> = {};
          for (const [name, selector] of Object.entries(wanted)) {
            const element = host.querySelector(selector);
            const rect = element?.getBoundingClientRect();
            out[name] = rect ? { top: Math.round(rect.top), height: Math.round(rect.height) } : null;
          }
          return out;
        }, selectors);

    /*
     * The row stacks below 620px, by a container query — so `top` is only
     * comparable in the desktop project, while the height each control takes is
     * the claim at either width. Asserted separately rather than skipping the
     * narrow project, because a 36px control among 48px ones is the read-only
     * defect and it stacks just the same.
     */
    const inOneRow = (width: number) => width > 620;

    test('editable: the offset reads at the same height as the date', async ({ page }) => {
      await open(page, '07-timezone');

      const row = await boxes(page, {
        dateField: '.cee-temporal-date mat-form-field',
        clock: '.cee-time-input-shell',
        offsetField: '.cee-temporal-offset mat-form-field',
        dateText: '.cee-temporal-date input',
        offsetText: '.mat-mdc-select-value',
      });
      const width = page.viewportSize()!.width;

      expect(row.offsetField!.height, 'every control in the row is one height').toBe(row.dateField!.height);
      expect(row.clock!.height).toBe(row.dateField!.height);
      expect(row.offsetText!.height, 'the offset text is as tall as the date text').toBe(row.dateText!.height);

      if (inOneRow(width)) {
        expect(row.offsetField!.top, 'the three controls are one row').toBe(row.dateField!.top);
        expect(row.clock!.top).toBe(row.dateField!.top);
        expect(row.offsetText!.top, 'the offset text sits where the date text sits').toBe(row.dateText!.top);
      }
    });

    /*
     * Read-only has no row to line up. Three boxes reading `YYYY-MM-DD`, `HH:MM` and an offset said
     * the same thing three times and never lined up between them; the field states its notation as
     * one specification instead, which `read-only states a temporal field as one box` covers.
     */

    /**
     * Both separators in the row are the same separator.
     *
     * The `.` before the decimal-seconds box asked for 18px and took the default
     * black, while the `:` between hour, minute and second — inches away, inside
     * the same control — is 14px and #555. Two glyphs doing one job in two sizes
     * and two colours, and it was the last rendered size in the editor that
     * belonged to no scale.
     *
     * A DOM assertion rather than a baseline, because a period is roughly thirty
     * pixels and the change moved none of the 108 snapshots. That is the miss the
     * budget comment above predicts in as many words — the smaller the thing that
     * broke, the more slack a ratio gives it — so pixels cannot hold this and are
     * not asked to.
     */
    test('the decimal point matches the colons beside it', async ({ page }) => {
      await open(page, '09-temporal');

      const separators = await page
        .locator('app-cedar-input-datetime')
        .filter({ has: page.locator('.cee-fraction-separator') })
        .first()
        .evaluate((host) => {
          const read = (selector: string) => {
            const element = host.querySelector(selector);
            if (!element) return null;
            const style = getComputedStyle(element);
            return { fontSize: style.fontSize, color: style.color };
          };
          return { point: read('.cee-fraction-separator'), colon: read('.cee-time-separator') };
        });

      expect(separators.colon, 'no clock separator to compare against').not.toBeNull();
      expect(separators.point, 'this fixture should hold a decimal-seconds field').not.toBeNull();
      expect(separators.point, 'the decimal point diverged from the colons in the same control').toEqual(
        separators.colon,
      );
    });

    /**
     * No placeholder in the row is shaped like a value.
     *
     * The decimal-seconds box used to read `000`, which is both a placeholder and a
     * valid value — and at this granularity the fraction is a *required* part, so an
     * empty box means the field records nothing. Date and time filled with a grey
     * `000` beside them therefore looked complete and stored `null`, while typing
     * `000` stored `…T02:30:15.000`. The two opposite states differed only in text
     * colour.
     *
     * Asserted as a rule about every placeholder rather than a check on one string,
     * because the next digit-shaped placeholder would be the same bug. The clock's
     * own `HH`/`MM`/`SS` already satisfy it, which is what made the fraction the
     * odd one out.
     *
     * A DOM assertion for the same reason as the separator above: changing `000` to
     * `sss` moved none of the 108 baselines, three grey glyphs being well under the
     * budget.
     */
    test('no placeholder in the temporal row can be mistaken for a value', async ({ page }) => {
      await open(page, '09-temporal');

      const placeholders = await page
        .locator('app-cedar-input-datetime')
        .filter({ has: page.locator('.cee-fraction-separator') })
        .first()
        .evaluate((host) =>
          [...host.querySelectorAll('input[placeholder]')].map((input) => (input as HTMLInputElement).placeholder),
        );

      expect(placeholders.length, 'expected the clock segments and the fraction box').toBeGreaterThan(1);
      const valueShaped = placeholders.filter((text) => /^[\d\s.:]+$/.test(text));
      expect(valueShaped, 'a placeholder made of digits is indistinguishable from data').toEqual([]);
    });
  });

  test('the 12-hour fields show a meridian control and the others do not', async ({ page }) => {
    await open(page, '09-temporal');
    await expect(page.locator('.cee-time-meridian'), 'only the two 12h fields').toHaveCount(2);
    await expect(pickerFor(page, 'twelve_hour').locator('.cee-time-meridian')).toHaveText(/AM|PM/);
    await expect(pickerFor(page, 'to_the_minute').locator('.cee-time-meridian')).toHaveCount(0);
  });

  test('typing an hour stores it', async ({ page }) => {
    await open(page, '09-temporal');
    const hour = pickerFor(page, 'to_the_minute').locator('input[aria-label="Hour"]');
    await hour.fill('14');
    await page.waitForTimeout(300);

    expect(String(await storedValue(page, '_to_the_minute'))).toContain('14:');
  });

  /**
   * The boxes the user did not type into show what the field stores once the user leaves.
   *
   * A typed hour stores `14:00:00`, and the model writes that instant back while the hour
   * still has focus. `writeValue` rightly leaves drafts alone during an edit, so on leaving
   * the clock the minute box went on reading `MM` over a stored `00` — a placeholder standing
   * over a value, which is the one thing the letter placeholders exist to rule out.
   */
  test('leaving the clock shows the minutes the field padded', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_minute');
    const hour = picker.locator('input[aria-label="Hour"]');
    const minute = picker.locator('input[aria-label="Minute"]');
    await hour.fill('14');
    await expect(minute, 'not while the user is still in the clock').toHaveValue('');

    await hour.blur();

    await expect(minute).toHaveValue('00');
    expect(String(await storedValue(page, '_to_the_minute'))).toContain('14:00');
  });

  test('an out-of-range typed hour waits for blur, then restores instead of wrapping', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_minute');
    const hour = picker.locator('input[aria-label="Hour"]');

    await hour.fill('25');
    await expect(hour, 'do not interrupt while the user is still typing').toHaveValue('25');
    await expect(picker.getByRole('alert')).toHaveCount(0);
    expect(await storedValue(page, '_to_the_minute'), 'an invalid edit must never reach metadata').toBeNull();

    await hour.blur();
    await expect(hour, 'there was no previous value, so blur restores the empty field').toHaveValue('');
    await expect(picker.getByRole('alert')).toContainText('00 to 23');

    await hour.fill('14');
    await expect(picker.getByRole('alert'), 'a correction clears the feedback live').toHaveCount(0);
    await expect.poll(async () => String(await storedValue(page, '_to_the_minute'))).toContain('14:');
  });

  /** Wrapping rather than clamping when a focused segment is stepped. */
  test('stepping past the end of an hour wraps to the start', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_minute');
    const hour = picker.locator('input[aria-label="Hour"]');
    await hour.fill('23');
    await page.waitForTimeout(200);

    await hour.press('ArrowUp');
    await page.waitForTimeout(300);

    // Zero-padded, as a clock reads and as the dependency this replaced did.
    await expect(hour).toHaveValue('00');
    expect(String(await storedValue(page, '_to_the_minute'))).toContain('00:');
  });

  test('stepping below zero wraps to the end', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_minute');
    const minute = picker.locator('input[aria-label="Minute"]');
    await minute.fill('0');
    await page.waitForTimeout(200);
    await minute.press('ArrowDown');
    await page.waitForTimeout(300);

    await expect(minute).toHaveValue('59');
  });

  test('seconds reach the stored value', async ({ page }) => {
    await open(page, '09-temporal');
    const second = pickerFor(page, 'to_the_second').locator('input[aria-label="Second"]');
    await second.fill('42');
    await page.waitForTimeout(300);

    expect(String(await storedValue(page, '_to_the_second'))).toContain(':42');
  });

  /**
   * The invariant worth guarding above all others: CEDAR stores a 24-hour clock
   * whatever the field displays. A 12-hour field showing 2 PM must store 14.
   */
  test('a 12-hour field stores 24-hour time', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'twelve_hour');
    const hour = picker.locator('input[aria-label="Hour"]');
    const meridian = picker.locator('.cee-time-meridian');

    await hour.fill('2');
    await page.waitForTimeout(200);
    if ((await meridian.textContent())?.trim() === 'AM') {
      await meridian.click();
      await page.waitForTimeout(200);
    }
    await expect(meridian).toHaveText('PM');
    await page.waitForTimeout(300);

    const stored = String(await storedValue(page, '_twelve_hour'));
    expect(stored, `2 PM must store as 14, got ${stored}`).toContain('14:');
  });

  test('a 12-hour field stores midnight as 00, not 12', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'twelve_hour');
    const hour = picker.locator('input[aria-label="Hour"]');
    const meridian = picker.locator('.cee-time-meridian');

    await hour.fill('12');
    await page.waitForTimeout(200);
    if ((await meridian.textContent())?.trim() === 'PM') {
      await meridian.click();
      await page.waitForTimeout(200);
    }
    await expect(meridian).toHaveText('AM');
    await page.waitForTimeout(300);

    expect(String(await storedValue(page, '_twelve_hour'))).toContain('00:');
  });

  /**
   * Noon, which is the case a 12-hour clock actually gets wrong.
   *
   * Added because mutation-testing the conversion exposed the gap: breaking
   * `12 PM → 12` failed the unit tests and passed all fifteen browser tests,
   * because the cases here were 2 PM and 12 AM and neither exercises it. 2 PM
   * survives most plausible off-by-twelve bugs; noon survives none of them.
   */
  test('a 12-hour field stores noon as 12', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'twelve_hour');
    const hour = picker.locator('input[aria-label="Hour"]');
    const meridian = picker.locator('.cee-time-meridian');

    await hour.fill('12');
    await page.waitForTimeout(200);
    if ((await meridian.textContent())?.trim() === 'AM') {
      await meridian.click();
      await page.waitForTimeout(200);
    }
    await expect(meridian).toHaveText('PM');
    await page.waitForTimeout(300);

    const stored = String(await storedValue(page, '_twelve_hour'));
    expect(stored, `noon must store as 12, got ${stored}`).toContain('12:');
  });

  /**
   * The colons line up with the digits.
   *
   * Guarded rather than eyeballed because a screenshot would report only that
   * pixels moved. The semantic failure is simpler: punctuation in a segmented
   * clock must share the digits' baseline and remain visible.
   */
  test('the colons sit level with the digits', async ({ page }) => {
    await open(page, '09-temporal');

    const offsets = await page.evaluate(() => {
      const picker = document
        .querySelector('cedar-embeddable-editor')!
        .shadowRoot!.querySelectorAll('.cee-time-picker')[2]; // to_the_second
      const digit = picker.querySelector('input[aria-label="Hour"]')!.getBoundingClientRect();
      const digitCentre = digit.top + digit.height / 2;
      return Array.from(picker.querySelectorAll('.cee-time-separator')).map((sep) => {
        const box = sep.getBoundingClientRect();
        return { off: box.top + box.height / 2 - digitCentre, width: box.width };
      });
    });

    expect(offsets, 'two colons on a to-the-second field').toHaveLength(2);
    for (const { off, width } of offsets) {
      expect(Math.abs(off), `colon is ${off.toFixed(1)}px off the digit centre`).toBeLessThan(3);
      // A zero-width colon is positioned perfectly and invisible, which is
      // exactly the failure one of the earlier attempts produced.
      expect(width, 'the colon has to actually be visible').toBeGreaterThan(2);
    }
  });

  test('read-only states a temporal field as one box, with no clock to drive', async ({ page }) => {
    await open(page, '09-temporal', 'readonly');

    expect(await page.locator('input[aria-label="Hour"]').count()).toBe(0);
    const specs = page.locator('.cee-spec-box');
    expect(await specs.count(), 'every temporal field states its notation').toBeGreaterThan(0);
    await expect(specs.first()).toContainText('YYYY');
  });

  test('read-only shows each recorded instant cut to its own granularity', async ({ page }) => {
    await open(page, '21-temporal-normalization', 'readonly', '21-temporal-normalization-instance');

    const boxes = page.locator('app-cedar-input-datetime input');
    await expect(boxes.first()).toHaveAttribute('readonly', 'true');
    // The control stores an instant, so the day field holds `2026-08-09T00:00:00` and the minute
    // field `21:45:00`. Neither midnight nor that zero second is anything the instance asserts.
    expect(await boxes.evaluateAll((inputs: HTMLInputElement[]) => inputs.map((input) => input.value))).toEqual([
      '2026',
      '2026-08',
      '2026-08-09',
      '21:45',
      '21:45:32.001',
    ]);
  });

  test('one clear action removes every part of a temporal value', async ({ page }) => {
    await open(page, '21-temporal-normalization', undefined, '21-temporal-normalization-instance');
    const field = page.locator('app-cedar-input-datetime').nth(4); // time_fraction

    await field.getByRole('button', { name: 'Clear', exact: true }).click();

    await expect.poll(() => storedValue(page, '_time_fraction')).toBeNull();
    await expect(field.locator('input[aria-label="Hour"]')).toHaveValue('');
    await expect(field.locator('input[aria-label="Minute"]')).toHaveValue('');
    await expect(field.locator('input[aria-label="Second"]')).toHaveValue('');
    await expect(field.locator('input[aria-label="Select Decimal Seconds"]')).toHaveValue('');
  });
});

/**
 * Granularity is a storage rule, not only a decision about which boxes render.
 *
 * These values arrive with deliberately finer information. Loading the instance
 * must rewrite them to the neutral padding defined by the field's granularity,
 * while a decimal-second value keeps its exact fraction digits.
 */
test('normalizes existing temporal values to their declared granularity', async ({ page }) => {
  await open(page, '21-temporal-normalization', undefined, '21-temporal-normalization-instance');

  await expect
    .poll(() =>
      page
        .evaluate(() => document.querySelector('cedar-embeddable-editor')!.currentMetadata)
        .then((metadata) => ({
          year: valueOf(metadata, '_date_year'),
          month: valueOf(metadata, '_date_month'),
          day: valueOf(metadata, '_datetime_day'),
          minute: valueOf(metadata, '_time_minute'),
          fraction: valueOf(metadata, '_time_fraction'),
        })),
    )
    .toEqual({
      year: '2026-01-01',
      month: '2026-08-01',
      day: '2026-08-09T00:00:00',
      minute: '21:45:00',
      fraction: '21:45:32.001',
    });

  const fields = page.locator('app-cedar-input-datetime');
  await expect(fields).toHaveCount(5);
  await expect(fields.nth(2).locator('app-date-picker'), 'dateTime/day keeps its date input').toHaveCount(1);
  await expect(fields.nth(2).locator('.cee-time-picker'), 'dateTime/day hides finer time input').toHaveCount(0);
});
