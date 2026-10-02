/**
 * What a form shows when it opens an instance stored with problems, and how a host
 * takes the user to each one.
 *
 * Every other fixture is either empty or valid, so the fields in this suite were
 * the first to hold a bad value nobody had typed. A value loaded from a stored
 * instance is neither dirty nor touched, and the form said nothing under a field the
 * data quality report listed as wrong. A host listing the problems also had no way to
 * reach a field on another page or in another entry of a repeating element.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open } from './support/host';
import type { CeeLocation, CeeRevealOptions } from '../../src/app/cee-public-api';

const FIXTURE = '26-stored-problems';
const INSTANCE = '26-stored-problems-instance';

/** The rendered field or element whose header carries this label. */
const component = (page: Page, label: string): Locator =>
  page
    .locator('app-cedar-component-renderer')
    .filter({ has: page.locator('app-cedar-component-header', { hasText: new RegExp(`^\\s*${label}\\b`) }) })
    .last();

const reveal = (page: Page, location: CeeLocation, options?: CeeRevealOptions): Promise<boolean> =>
  page.evaluate(([where, how]) => document.querySelector('cedar-embeddable-editor')!.reveal(where, how), [
    location,
    options,
  ] as const);

/** The report's problem at this path, with the entries it names. */
const problemAt = (page: Page, path: string[], code: string) =>
  page.evaluate(
    ([where, kind]) =>
      document
        .querySelector('cedar-embeddable-editor')!
        .dataQualityReport.problems.find((problem) => problem.path.join('/') === where && problem.code === kind),
    [path.join('/'), code] as const,
  );

test.beforeEach(async ({ page }) => {
  await open(page, FIXTURE, undefined, INSTANCE);
});

test('states every stored problem at its field as soon as the form opens', async ({ page }) => {
  const expected: Array<[string, string]> = [
    ['email', 'Value should be a valid email address.'],
    ['website', 'Value should be a valid URL.'],
    ['phone', 'Value should be a valid phone number.'],
    ['code', 'Value should be at least 8 chars long.'],
    ['count', 'The value should be an integer.'],
    ['region', '"Elsewhere" is not one of the options for this field.'],
    ['answer', '"Maybe" is not one of the options for this field.'],
    ['consent', '"Unsure" is not one of the options for this field.'],
    ['contributor', 'The stored identifier is not a valid IRI.'],
    ['organism', 'The stored term is missing its label or its IRI.'],
  ];
  for (const [label, message] of expected) {
    await expect(component(page, label).locator('mat-error'), label).toHaveText([message]);
  }
});

test('keeps an unanswered requirement quiet until the user is taken to it', async ({ page }) => {
  const title = component(page, 'title');
  await expect(title.locator('mat-error')).toHaveCount(0);

  expect(await reveal(page, { path: ['_title'] })).toBe(true);

  await expect(title.locator('mat-error')).toHaveText(['The value is required.']);
  await expect(title.locator('input')).toBeFocused();
});

test('turns to the page and the entries that hold a problem', async ({ page }) => {
  const problem = await problemAt(page, ['_team', '_member', '_email'], 'email');
  expect(problem?.occurrences).toEqual([1, 1]);

  expect(await reveal(page, problem!)).toBe(true);

  const input = page.locator('app-cedar-input-email input:focus');
  await expect(input).toHaveValue('nested-is-bad');
  await expect(input).toBeInViewport();
  await expect(component(page, 'title')).toHaveCount(0);
  await expect(
    page
      .locator('app-cedar-input-email')
      .filter({ has: page.locator('input:focus') })
      .locator('mat-error'),
  ).toHaveText(['Value should be a valid email address.']);
});

test('reaches the second entry of a repeating element even when its panel is collapsed', async ({ page }) => {
  await page.getByRole('button', { name: 'Collapse All' }).click();
  const problem = await problemAt(page, ['_person', '_email'], 'email');
  expect(problem?.occurrences).toEqual([1]);

  expect(await reveal(page, problem!)).toBe(true);

  const input = page.locator('app-cedar-input-email input:focus');
  await expect(input).toHaveValue('second-is-bad');
  await expect(input).toBeInViewport();
});

test('states a list too short for its minimum once the user is taken to it', async ({ page }) => {
  expect(await reveal(page, { path: ['_person'] }, { focus: false })).toBe(true);
  const aliases = component(page, 'aliases');
  await expect(aliases.locator('.cee-field-problem')).toHaveCount(0);

  expect(await reveal(page, { path: ['_aliases'] })).toBe(true);

  await expect(aliases.locator('.cee-field-problem')).toHaveText(['At least 3 entries are required.']);
});

test('leaves focus where it is when the host asks', async ({ page }) => {
  const problem = await problemAt(page, ['_person', '_email'], 'email');

  expect(await reveal(page, problem!, { focus: false })).toBe(true);

  const input = component(page, 'person').locator('app-cedar-input-email input');
  await expect(input).toHaveValue('second-is-bad');
  await expect(input).toBeInViewport();
  await expect(input).not.toBeFocused();
});

test('refuses a place the form does not have, and changes nothing', async ({ page }) => {
  expect(await reveal(page, { path: ['_nothing'] })).toBe(false);
  expect(await reveal(page, { path: ['_team', '_member', '_email'], occurrences: [1, 7] })).toBe(false);

  // Still on the first page, and the next reveal still finds the entries it names.
  await expect(component(page, 'title')).toBeVisible();
  const problem = await problemAt(page, ['_team', '_member', '_email'], 'email');
  expect(await reveal(page, problem!)).toBe(true);
  await expect(page.locator('app-cedar-input-email input:focus')).toHaveValue('nested-is-bad');
});
