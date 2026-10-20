import { expect, test, type Locator, type Page } from '@playwright/test';
import type { CeeLocation, CeeRevealOptions } from '../../src/app/cee-public-api';
import { open, passDebounceWindow } from './support/host';

/**
 * WCAG 4.1.3, Status Messages, and 3.3.1, Error Identification, for the messages CEE draws outside
 * a Material form field.
 *
 * Material announces the errors inside a form field through the field's own live region and links
 * them to the control. The rest are CEE's to announce and link: a field's report problems, which
 * sit in a live region of their own present as long as the field is, and a widget's own messages,
 * which the element's live region announces. That region is inside the shadow root, and each
 * message is in the description of the controls it concerns. Nothing here moves focus.
 */

/** The live region a widget's own messages are announced through. */
const liveRegion = (page: Page, host = 'cedar-embeddable-editor'): Locator =>
  page.locator(host).locator('.cee-live-region');

/** The innermost focused element, across shadow roots, as a string to compare. */
const focused = (page: Page): Promise<string> =>
  page.evaluate(() => {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active ? `${active.tagName} ${active.getAttribute('aria-label') ?? ''}` : '';
  });

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

test("the element's live region sits in its shadow root, marked with its language", async ({ page }) => {
  await open(page, '25-required-choices', 'hu');
  const region = liveRegion(page);
  await expect(region).toHaveAttribute('aria-live', 'polite');
  await expect(region).toHaveAttribute('lang', 'hu');
  expect(await page.evaluate(() => document.body.querySelector('.cee-live-region'))).toBeNull();
});

test.describe('report problems', () => {
  test('describe the controls of the field they are about', async ({ page }) => {
    await open(page, '26-stored-problems', undefined, '26-stored-problems-instance');
    const notOption = /is not one of the options for this field/;
    for (const radio of await component(page, 'answer').getByRole('radio').all())
      await expect(radio).toHaveAccessibleDescription(notOption);
    await expect(component(page, 'region').getByRole('combobox')).toHaveAccessibleDescription(notOption);
    // Beside the field's own description, which describes its controls too.
    await expect(component(page, 'contributor').getByRole('textbox')).toHaveAccessibleDescription(
      'The stored identifier is not a valid IRI. contributor property description',
    );
  });

  test('are announced by a live region present before they appear, and focus stays put', async ({ page }) => {
    await open(page, '26-stored-problems', undefined, '26-stored-problems-instance');
    // The second page, where the list waits for the user to be taken to it.
    expect(await reveal(page, { path: ['_person'] }, { focus: false })).toBe(true);
    const problems = component(page, 'aliases').locator('app-cedar-field-problems');
    await expect(problems).toHaveAttribute('aria-live', 'polite');
    await expect(problems).toHaveText('');
    const id = await problems.getAttribute('id');
    const before = await focused(page);

    expect(await reveal(page, { path: ['_aliases'] }, { focus: false })).toBe(true);

    await expect(problems).toHaveText('Warning: At least 3 entries are required.');
    expect(await problems.getAttribute('id'), 'the same region, not a new one').toBe(id);
    expect(await focused(page)).toBe(before);
    await expect(component(page, 'aliases').getByRole('textbox')).toHaveAccessibleDescription(
      'Warning: At least 3 entries are required. aliases property description',
    );
  });

  test("about an element describe the element's heading", async ({ page }) => {
    await page.route('**/fixtures/26-stored-problems.json', async (route) => {
      const template = await (await route.fetch()).json();
      template.properties._person.minItems = 3;
      await route.fulfill({ json: template });
    });
    await open(page, '26-stored-problems', undefined, '26-stored-problems-instance');
    expect(await reveal(page, { path: ['_person'] }, { focus: false })).toBe(true);
    const person = page
      .locator('mat-expansion-panel')
      .filter({ has: page.getByText(/^\s*person\b/) })
      .first();
    await expect(
      person.locator(':scope > .mat-expansion-panel-content-wrapper app-cedar-field-problems').first(),
    ).toHaveText(/At least 3/);
    await expect(person.locator(':scope > mat-expansion-panel-header')).toHaveAccessibleDescription(/At least 3/);
  });
});

test.describe("a widget's own messages", () => {
  test('a required checkbox group announces its error and links it to every option', async ({ page }) => {
    await open(page, '25-required-choices');
    const group = page.locator('app-cedar-input-checkbox').first();
    const agree = group.getByRole('checkbox', { name: 'Agree' });
    await agree.focus();
    await agree.blur();
    await expect(group.locator('mat-error')).toBeVisible();
    await expect(liveRegion(page)).toHaveText(/at least one/i);
    for (const checkbox of await group.getByRole('checkbox').all())
      await expect(checkbox).toHaveAccessibleDescription(/at least one/i);

    await agree.click();
    await expect(group.locator('mat-error')).toHaveCount(0);
    await expect(agree).toHaveAccessibleDescription('consent property description');
  });

  test("a temporal row announces the part still missing and links it to the row's controls", async ({ page }) => {
    await open(page, '09-temporal');
    const field = page.locator('app-cedar-input-datetime').filter({
      has: page.locator('input[aria-label$=", select decimal seconds"]'),
    });
    const hour = field.getByRole('textbox', { name: 'Hour', exact: true });
    await hour.fill('14');
    await expect(field.locator('mat-error')).toHaveText(/date is still needed/);
    await expect(liveRegion(page)).toHaveText(/date is still needed/);
    expect(await focused(page)).toBe('INPUT Hour');
    await expect(hour).toHaveAccessibleDescription(/date is still needed/);
    await expect(field.getByRole('textbox', { name: 'decimal_seconds, select date' })).toHaveAccessibleDescription(
      /date is still needed/,
    );
  });

  test('a failed authority search is announced and describes the box while the list shows it', async ({ page }) => {
    await open(page, '08-authority');
    // A textbox while empty and a combobox once typed into, so found by its name alone.
    const input = page.locator('input[aria-label="contributor_orcid"]');
    await input.fill('test search');
    await passDebounceWindow(page);
    // The smokes find this option by name, so the name stays the message.
    const failed = page.getByRole('option', { name: 'Search failed: the service could not be reached', exact: true });
    await expect(failed).toBeVisible();
    await expect(liveRegion(page)).toHaveText('Search failed: the service could not be reached');
    await expect(input).toHaveAccessibleDescription(
      'contributor_orcid property description Search failed: the service could not be reached',
    );
    expect(await focused(page)).toBe('INPUT contributor_orcid');

    await input.press('Escape');
    await expect(failed).toHaveCount(0);
    await expect(input).toHaveAccessibleDescription('contributor_orcid property description');
  });

  test('a failed term search is announced and describes the box', async ({ page }) => {
    await page.route('http://127.0.0.1:9/**', (route) => route.abort());
    await open(page, '04-controlled-terms');
    const input = page.getByRole('combobox', { name: 'organism', exact: true });
    await input.fill('Homo');
    await passDebounceWindow(page);
    await expect(page.getByRole('option', { name: /^Search failed/ })).toBeVisible();
    await expect(liveRegion(page)).toHaveText('Search failed: the service could not be reached');
    await expect(input).toHaveAccessibleDescription(
      'organism property description Search failed: the service could not be reached',
    );
  });

  test("an authority search that finds nothing says so through the field element's own region", async ({ page }) => {
    await page.route('http://127.0.0.1:9/**', (route) => route.fulfill({ json: { found: false, results: {} } }));
    await open(page, '08-authority', undefined, undefined, undefined, '&host=field&p=_contributor_orcid');
    const field = page.locator('cedar-embeddable-field');
    const input = field.locator('input').first();
    await input.fill('Unmatched example');
    await passDebounceWindow(page);
    await expect(page.getByRole('option', { name: 'No results found', exact: true })).toBeVisible();
    await expect(liveRegion(page, 'cedar-embeddable-field')).toHaveText('No results found');
    await expect(input).toHaveAccessibleDescription('No results found');
  });

  test("an error inside a Material form field is left to the form field's own region", async ({ page }) => {
    await open(page, '01-input-types');
    const email = page.getByRole('textbox', { name: 'email', exact: true });
    await email.fill('not an address');
    await email.blur();
    await expect(page.locator('app-cedar-input-email mat-error')).toBeVisible();
    await expect(email).toHaveAccessibleDescription(/valid email/);
    await expect(liveRegion(page)).toHaveText('');
  });
});
