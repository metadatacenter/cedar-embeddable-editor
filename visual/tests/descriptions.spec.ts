import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAttributeRow, open } from './support/host';

/**
 * WCAG 1.3.1, Info and Relationships, and 4.1.2, Name, Role, Value, for a field's description.
 *
 * A field's description describes each of its controls through `aria-describedby`, beside the
 * problems and messages that describe them too. Editing, the description is visually hidden text in
 * the field's header. Read-only, it is the paragraph below the header, and the header carries no
 * hidden copy, so the page holds it once. An element's description describes its panel header, and
 * is hidden inside that header so the header's name does not repeat it.
 *
 * An exact accessible description is the assertion that nothing is read twice: the description
 * appears in it once, and nothing else does while the field has no problem to report.
 */

/** The rendered field whose header carries this label. */
const field = (page: Page, label: string): Locator =>
  page
    .locator('app-cedar-component-renderer')
    .filter({ has: page.locator('app-cedar-component-header', { hasText: new RegExp(`^\\s*${label}\\b`) }) })
    .last();

const described = (label: string): string => `${label} property description`;

test('editing, each text box, number box and date box is described by its field', async ({ page }) => {
  await open(page, '01-input-types');
  for (const label of ['text', 'textarea', 'email', 'phone', 'link'])
    await expect(page.getByRole('textbox', { name: label, exact: true })).toHaveAccessibleDescription(described(label));
  await expect(field(page, 'numeric').locator('input')).toHaveAccessibleDescription(described('numeric'));
  for (const control of await field(page, 'date').locator('input').all())
    await expect(control).toHaveAccessibleDescription(described('date'));
});

test('editing, each radio, checkbox and select is described by its field', async ({ page }) => {
  await open(page, '02-choices');
  for (const radio of await field(page, 'radio').getByRole('radio').all())
    await expect(radio).toHaveAccessibleDescription(described('radio'));
  for (const checkbox of await field(page, 'checkbox').getByRole('checkbox').all())
    await expect(checkbox).toHaveAccessibleDescription(described('checkbox'));
  for (const label of ['single_list', 'multi_list'])
    await expect(page.getByRole('combobox', { name: label, exact: true })).toHaveAccessibleDescription(
      described(label),
    );
});

test("editing, a temporal row's date and time boxes are all described by their field", async ({ page }) => {
  await open(page, '09-temporal');
  const controls = field(page, 'decimal_seconds').locator('input');
  await expect(controls).toHaveCount(5);
  for (const control of await controls.all())
    await expect(control).toHaveAccessibleDescription(described('decimal_seconds'));
});

test('editing, a term box, an authority box and attribute boxes are described by their field', async ({ page }) => {
  await open(page, '04-controlled-terms');
  await expect(page.locator('input[aria-label="organism"]')).toHaveAccessibleDescription(described('organism'));
  await open(page, '08-authority');
  await expect(page.locator('input[aria-label="contributor_orcid"]')).toHaveAccessibleDescription(
    described('contributor_orcid'),
  );
  await open(page, '10-attribute-values');
  await addAttributeRow(page);
  for (const name of ['Attribute Name', 'Attribute Value'])
    await expect(page.getByRole('textbox', { name, exact: true })).toHaveAccessibleDescription(described('attribute'));
});

test('editing, the description is in the page once, as hidden text in the header', async ({ page }) => {
  await open(page, '01-input-types');
  const text = field(page, 'text');
  await expect(text.locator('.cee-description')).toHaveText(described('text'));
  await expect(text.getByText(described('text'), { exact: true })).toHaveCount(1);
});

test('read only, the paragraph below the header describes the controls, and no hidden copy repeats it', async ({
  page,
}) => {
  await open(page, '02-choices', 'readonly', '02-choices-selected-instance');
  const radio = field(page, 'radio');
  await expect(radio.locator('.cee-description')).toHaveCount(0);
  await expect(radio.getByText(described('radio'), { exact: true })).toHaveCount(1);
  for (const option of await radio.getByRole('radio').all())
    await expect(option).toHaveAccessibleDescription(described('radio'));
  for (const checkbox of await field(page, 'checkbox').getByRole('checkbox').all())
    await expect(checkbox).toHaveAccessibleDescription(described('checkbox'));
  await expect(page.getByRole('textbox', { name: 'bounded_list', exact: true })).toHaveAccessibleDescription(
    described('bounded_list'),
  );
});

test('the field element read only describes its controls with its paragraph', async ({ page }) => {
  // The field element shows a field's own description, which this fixture gives only its template.
  await page.route('**/fixtures/02-choices.json', async (route) => {
    const template = await (await route.fetch()).json();
    template.properties._radio['schema:description'] = described('radio');
    await route.fulfill({ json: template });
  });
  await open(page, '02-choices', 'readonly', undefined, undefined, '&host=field&p=_radio');
  const element = page.locator('cedar-embeddable-field');
  await expect(element.locator('.cee-field-spec-description')).toHaveText(described('radio'));
  await expect(element.locator('.cee-description')).toHaveCount(0);
  for (const option of await element.getByRole('radio').all())
    await expect(option).toHaveAccessibleDescription(described('radio'));
});

test("an element's description describes its panel header and stays out of the header's name", async ({ page }) => {
  await open(page, '03-nested-multi');
  const heading = page.locator('mat-expansion-panel-header').first();
  await expect(heading).toHaveAccessibleDescription(described('author'));
  await expect(heading).toHaveAccessibleName(/^author \(3 \.\. 5\)/);
  await expect(heading).not.toHaveAccessibleName(/property description/);
});
