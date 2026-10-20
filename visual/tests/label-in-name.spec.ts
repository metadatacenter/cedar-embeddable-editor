import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, passDebounceWindow } from './support/host';

/**
 * WCAG 2.5.3, Label in Name, and 4.1.2, Name, Role, Value, for the controls axe does not judge.
 *
 * axe checks Label in Name only for controls whose name comes from their content, such as buttons.
 * A text box, a select or a group of options is labelled by the field's heading instead, so a
 * speech user reaches it by saying that heading. Each such control's name has to contain it.
 */

/** A pattern matching the text anywhere in a name. */
const containing = (text: string): RegExp => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/**
 * Every control a field's heading labels, beside the heading's text.
 *
 * A box with a floating label of its own, such as an attribute's name, is labelled by that instead,
 * and a radio or a checkbox by its option. A time's hour, minute and second sit inside a group the
 * heading names. The multiple-choice widget's display:none input carries the form-field state only.
 */
const LABELLED_BY_HEADING =
  ':is(input[matinput], textarea[matinput]):not([style*="display: none"]):not(mat-form-field:has(mat-label) *),' +
  ' mat-select, mat-radio-group, form[role="group"], .cee-time-picker[role="group"]';

async function fieldsWithControls(page: Page): Promise<{ label: string; controls: Locator[] }[]> {
  const fields = page.locator('cedar-embeddable-editor').locator('.non-iterable-component');
  const found: { label: string; controls: Locator[] }[] = [];
  for (const field of await fields.all()) {
    const label = await field
      .locator('app-cedar-component-header .title-label')
      .first()
      .evaluate((element) => element.childNodes[0]?.textContent?.trim() ?? '');
    const controls = await field.locator('app-cedar-field-widget').locator(LABELLED_BY_HEADING).all();
    if (controls.length > 0) found.push({ label, controls });
  }
  return found;
}

for (const [fixture, preset] of [
  ['01-input-types', undefined],
  ['02-choices', undefined],
  ['04-controlled-terms', undefined],
  ['07-timezone', undefined],
  ['08-authority', undefined],
  ['09-temporal', undefined],
  ['09-temporal', 'hu'],
  ['10-attribute-values', undefined],
  ['21-temporal-normalization', undefined],
  ['17-real-flat', undefined],
] as const)
  test(`every control in ${fixture}${preset ? ` (${preset})` : ''} is named with its field's label`, async ({
    page,
  }) => {
    await open(page, fixture, preset);
    const fields = await fieldsWithControls(page);
    expect(fields.length).toBeGreaterThan(0);
    for (const { label, controls } of fields) {
      expect(label, 'a field heading with no label').not.toBe('');
      for (const control of controls) await expect(control).toHaveAccessibleName(containing(label));
    }
  });

test('the temporal controls name their field and their part of the value', async ({ page }) => {
  await open(page, '09-temporal');
  const editor = page.locator('cedar-embeddable-editor');
  await expect(editor.getByRole('textbox', { name: 'year_only, select year', exact: true })).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'day_only, select date', exact: true })).toBeVisible();
  await expect(editor.getByRole('group', { name: 'to_the_second, time', exact: true })).toBeVisible();
  await expect(
    editor.getByRole('textbox', { name: 'decimal_seconds, select decimal seconds', exact: true }),
  ).toBeVisible();

  await open(page, '21-temporal-normalization');
  await expect(
    page
      .locator('cedar-embeddable-editor')
      .getByRole('textbox', { name: /, select year and month$/ })
      .first(),
  ).toBeVisible();

  await open(page, '09-temporal', 'hu');
  await expect(
    page.locator('cedar-embeddable-editor').getByRole('textbox', { name: 'day_only, dátum kiválasztása', exact: true }),
  ).toBeVisible();
});

test('the offset select is named by its field and by what it shows, before and after a choice', async ({ page }) => {
  await open(page, '07-timezone');
  const offset = page.locator('cedar-embeddable-editor').getByRole('combobox');
  await expect(offset).toHaveAccessibleName('sampled_at Timezone unspecified');
  await offset.click();
  await page.getByRole('option', { name: 'UTC+05:30', exact: true }).click();
  await expect(offset).toContainText('UTC+05:30');
  await expect(offset).toHaveAccessibleName('sampled_at UTC+05:30');
});

test("the calendar's period button is named by the period it shows, in either view", async ({ page }) => {
  await open(page, '09-temporal');
  await page.locator('cedar-embeddable-editor').getByRole('textbox', { name: 'day_only, select date' }).click();
  await page.locator('app-date-picker').nth(1).getByRole('button', { name: 'Open calendar' }).click();
  const period = page.locator('.mat-calendar-period-button');
  await expect(period).toHaveText('01/01/2026');
  await expect(period).toHaveAccessibleName('01/01/2026, Choose month and year');
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(period).toHaveText('02/01/2026');
  await expect(period).toHaveAccessibleName('02/01/2026, Choose month and year');
  await period.click();
  await expect(period).toHaveText(/^\d{4} – \d{4}$/);
  await expect(period).toHaveAccessibleName(new RegExp(`^${await period.innerText()}, Choose date$`));
});

test('the choice groups are named by their field', async ({ page }) => {
  await open(page, '02-choices');
  const editor = page.locator('cedar-embeddable-editor');
  await expect(editor.getByRole('radiogroup', { name: 'radio', exact: true })).toBeVisible();
  const checkboxes = editor.getByRole('group', { name: 'checkbox', exact: true });
  await expect(checkboxes.getByRole('checkbox')).toHaveCount(2);
});

test('the option a term lookup shows meanwhile says that it is searching', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('http://127.0.0.1:9/**', async (route) => {
    await pending;
    await route.abort();
  });
  await open(page, '04-controlled-terms');
  await page.locator('cedar-embeddable-editor').getByRole('combobox', { name: 'organism', exact: true }).fill('Homo');
  await passDebounceWindow(page);
  await expect(page.getByRole('option', { name: 'Searching…', exact: true })).toBeVisible();
  await expect(page.getByRole('option').locator('mat-progress-spinner')).toBeVisible();
  release();
});
