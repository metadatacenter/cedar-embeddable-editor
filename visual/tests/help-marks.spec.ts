import { expect, test, type Locator, type Page } from '@playwright/test';
import { open } from './support/host';

/**
 * WCAG 1.1.1, Non-text Content, and 2.1.1, Keyboard, for the marks beside a label.
 *
 * Editing, a field's description and its property IRI are shown as tooltips on two marks at the end
 * of its title row, and a section break's description on a mark in its heading. Each mark is a Tab
 * stop, and focusing it from the keyboard shows the tooltip a pointer does, until Escape. The help
 * mark is named for what it holds, and the description is in visually hidden text beside it, so a
 * screen reader reads it once. An element's marks sit inside its panel header, a button, so they stay
 * out of the Tab order.
 */

/** The innermost focused element, across shadow roots, by its role and name. */
const focused = (page: Page): Promise<string> =>
  page.evaluate(() => {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active
      ? `${active.getAttribute('role') ?? active.tagName.toLowerCase()} ${active.getAttribute('aria-label') ?? ''}`
      : '';
  });

/**
 * The tooltips on screen. A tooltip that Tab moved past fades out over a moment, so one is found by
 * its text.
 */
const tooltip = (page: Page, text?: string | RegExp): Locator =>
  page.locator('.mat-mdc-tooltip-surface').filter(text === undefined ? {} : { hasText: text });

/** A field's title row, by the label it carries. */
const header = (page: Page, label: string): Locator =>
  page
    .locator('.non-iterable-component > app-cedar-component-header')
    .filter({ has: page.locator('.title-label', { hasText: new RegExp(`^\\s*${label}\\b`) }) });

const TEXTAREA_IRI = 'https://schema.metadatacenter.org/properties/b961a9ac-0000-4000-8000-b961a9ac0000';

test("a field's help and property marks are Tab stops between the previous control and its own", async ({ page }) => {
  await open(page, '01-input-types');
  await page.getByRole('textbox', { name: 'text', exact: true }).focus();
  const stops: string[] = [];
  for (let press = 0; press < 3; press++) {
    await page.keyboard.press('Tab');
    stops.push(await focused(page));
  }
  expect(stops).toEqual(['img Description', `img Property IRI: ${TEXTAREA_IRI}`, 'textarea textarea']);
});

test('focusing the help mark from the keyboard shows the description until Escape', async ({ page }) => {
  await open(page, '01-input-types');
  const help = header(page, 'textarea').getByRole('img', { name: 'Description', exact: true });
  await page.getByRole('textbox', { name: 'text', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(help).toBeFocused();
  expect(await help.evaluate((element) => element.matches(':focus-visible')), 'no focus ring drawn').toBe(true);
  await expect(tooltip(page, 'textarea property description')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(tooltip(page)).toHaveCount(0);
  await expect(help).toBeFocused();
});

test('focusing the property mark from the keyboard shows the IRI until Escape', async ({ page }) => {
  await open(page, '01-input-types');
  const property = header(page, 'textarea').getByRole('img', { name: /^Property IRI: / });
  await page.getByRole('textbox', { name: 'text', exact: true }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(property).toBeFocused();
  await expect(tooltip(page, TEXTAREA_IRI)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(tooltip(page)).toHaveCount(0);
  await expect(property).toBeFocused();
});

test('a screen reader reads the description once, and the IRI once', async ({ page }) => {
  await open(page, '01-input-types');
  const row = header(page, 'textarea');
  const help = row.getByRole('img', { name: 'Description', exact: true });
  // Neither mark is described by its own tooltip: one holds what the hidden text says, the other's
  // name already states its IRI.
  await expect(help).toHaveAccessibleDescription('');
  await expect(
    row.getByRole('img', { name: `Property IRI: ${TEXTAREA_IRI}`, exact: true }),
  ).toHaveAccessibleDescription('');
  await expect(row.locator('.cdk-visually-hidden')).toHaveText('textarea property description');
});

test('the help mark is named in the language the form is shown in', async ({ page }) => {
  await open(page, '01-input-types', 'hu');
  await expect(header(page, 'textarea').getByRole('img', { name: 'Leírás', exact: true })).toHaveAttribute(
    'tabindex',
    '0',
  );
});

test('read only, the property mark is still a Tab stop with its tooltip', async ({ page }) => {
  await open(page, '01-input-types', 'readonly');
  const row = header(page, 'textarea');
  await expect(row.getByRole('img', { name: 'Description', exact: true })).toHaveCount(0);
  const property = row.getByRole('img', { name: /^Property IRI: / });
  await expect(property).toHaveAttribute('tabindex', '0');
  await page.keyboard.press('Tab');
  for (let press = 0; press < 20 && !(await property.evaluate((element) => element.matches(':focus'))); press++)
    await page.keyboard.press('Tab');
  await expect(property).toBeFocused();
  await expect(tooltip(page, TEXTAREA_IRI)).toBeVisible();
});

test("a section break's help mark is a Tab stop that shows its description, and the heading keeps its name", async ({
  page,
}) => {
  await open(page, '20-static-markup');
  const heading = page.locator('app-cedar-static-section-break').getByRole('heading', { level: 1 });
  const help = heading.getByRole('img', { name: 'Description', exact: true });
  await expect(heading).toHaveAccessibleName(/^Heading <img data-static-markup/);
  await expect(heading).not.toHaveAccessibleName(/Description/);
  await expect(help).toHaveAttribute('tabindex', '0');

  await page.keyboard.press('Tab');
  for (let press = 0; press < 10 && !(await help.evaluate((element) => element.matches(':focus'))); press++)
    await page.keyboard.press('Tab');
  await expect(help).toBeFocused();
  await expect(tooltip(page, /^Help <img data-static-markup/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip(page)).toHaveCount(0);
  await expect(help).toBeFocused();
});

test("an element's marks stay out of the Tab order inside its panel header", async ({ page }) => {
  await open(page, '03-nested-multi');
  const panelHeader = page.locator('mat-expansion-panel-header').first();
  const help = panelHeader.locator('mat-icon.icon-help');
  await expect(help).toHaveAttribute('aria-hidden', 'true');
  await expect(help).not.toHaveAttribute('tabindex', /.*/);
  await expect(panelHeader.locator('.property-iri')).not.toHaveAttribute('tabindex', /.*/);
});
