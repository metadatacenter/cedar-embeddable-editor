import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAttributeRow, open } from './support/host';

/**
 * WCAG 2.4.3, Focus Order, and 2.1.1, Keyboard, where an action changes what can be focused.
 *
 * A clear button removes itself along with the value it clears, so focus moves to the control it
 * cleared instead of being dropped onto the page. A required-value message is read through its
 * control's description, so it is not a Tab stop of its own. And the page-break chips turn the
 * page from the keyboard as they do from the pointer.
 */

/** The innermost focused element, across shadow roots. */
const focusedElement = (page: Page) =>
  page.evaluate(() => {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active === null
      ? null
      : {
          tag: active.tagName.toLowerCase(),
          label: active.getAttribute('aria-label'),
          role: active.getAttribute('role'),
          error: active.closest('mat-error') !== null,
        };
  });

/** Activate a field's clear button from the keyboard, as a user tabbing to it would. */
async function clearFromKeyboard(field: Locator): Promise<void> {
  const clear = field.getByRole('button', { name: 'Clear', exact: true });
  await clear.focus();
  await clear.press('Enter');
  await expect(clear).toHaveCount(0);
}

test.describe('a clear button hands focus to the control it cleared', () => {
  for (const [label, kind] of [
    ['text', 'app-cedar-input-text'],
    ['textarea', 'app-cedar-input-text'],
    ['numeric', 'app-cedar-input-numeric'],
    ['email', 'app-cedar-input-email'],
    ['phone', 'app-cedar-input-phone'],
    ['link', 'app-cedar-input-link'],
  ] as const)
    test(`a ${label} box`, async ({ page }) => {
      await open(page, '01-input-types');
      const box = page.getByRole(label === 'numeric' ? 'spinbutton' : 'textbox', { name: label, exact: true });
      await box.fill(label === 'numeric' ? '42' : label === 'link' ? 'https://example.org/' : 'something');
      const field = page.locator(kind).filter({ has: box });
      await clearFromKeyboard(field);
      await expect(box).toHaveValue('');
      await expect(box).toBeFocused();
    });

  test('a single-choice select', async ({ page }) => {
    // The template's default fills it.
    await open(page, '02-choices');
    const select = page.getByRole('combobox', { name: 'single_list', exact: true });
    await clearFromKeyboard(page.locator('app-cedar-input-select').filter({ has: select }));
    await expect(select).toBeFocused();
  });

  test('a radio group, at the option that was chosen', async ({ page }) => {
    await open(page, '02-choices', undefined, '02-choices-selected-instance');
    const group = page.getByRole('radiogroup', { name: 'radio', exact: true });
    const chosen = group.getByRole('radio', { checked: true });
    const name = await chosen.getAttribute('value');
    await clearFromKeyboard(page.locator('app-cedar-input-multiple-choice'));
    await expect(group.locator(`input[value="${name}"]`)).toBeFocused();
    await expect(group.getByRole('radio', { checked: true })).toHaveCount(0);
  });

  test('a controlled term', async ({ page }) => {
    await open(page, '04-controlled-terms', undefined, '04-controlled-terms-instance');
    const field = page.locator('app-cedar-input-controlled').first();
    await clearFromKeyboard(field);
    await expect(field.locator('input[aria-label="organism"]')).toBeFocused();
  });

  test('an authority term', async ({ page }) => {
    await open(page, '08-authority', undefined, '08-authority-instance');
    const field = page.locator('app-cedar-input-pmid');
    await clearFromKeyboard(field);
    await expect(field.locator('input[aria-label="citation_pmid"]')).toBeFocused();
  });

  test('an attribute name and its value', async ({ page }) => {
    await open(page, '10-attribute-values');
    await addAttributeRow(page);
    const name = page.getByRole('textbox', { name: 'Attribute Name', exact: true });
    const value = page.getByRole('textbox', { name: 'Attribute Value', exact: true });
    await name.fill('colour');
    await value.fill('blue');
    const field = page.locator('app-cedar-input-attribute-value');
    await field.getByRole('button', { name: 'Clear', exact: true }).last().focus();
    await page.keyboard.press('Enter');
    await expect(value).toHaveValue('');
    await expect(value).toBeFocused();
    await clearFromKeyboard(field);
    await expect(name).toHaveValue('');
    await expect(name).toBeFocused();
  });

  test("a temporal row, at the row's first control", async ({ page }) => {
    await open(page, '09-temporal');
    const field = page.locator('app-cedar-input-datetime').filter({
      has: page.getByRole('group', { name: 'to_the_minute, time', exact: true }),
    });
    await field.getByRole('textbox', { name: 'Hour', exact: true }).fill('14');
    await clearFromKeyboard(field);
    await expect(field.getByRole('textbox', { name: 'Hour', exact: true })).toBeFocused();
  });

  test('a click hands focus over as a key press does', async ({ page }) => {
    await open(page, '01-input-types');
    const box = page.getByRole('textbox', { name: 'text', exact: true });
    await box.fill('something');
    await page.locator('app-cedar-input-text').filter({ has: box }).getByRole('button', { name: 'Clear' }).click();
    await expect(box).toBeFocused();
  });
});

test.describe('a required-value message is not a Tab stop', () => {
  /** Leave the control, and say where Tab goes from it once its message is showing. */
  async function tabFrom(control: Locator, page: Page) {
    await control.focus();
    await control.blur();
    await control.focus();
    await page.keyboard.press('Tab');
    return focusedElement(page);
  }

  test('beside a select', async ({ page }) => {
    await open(page, '25-required-choices');
    const select = page.getByRole('combobox', { name: 'regions', exact: true });
    await select.focus();
    await select.blur();
    const field = page.locator('app-cedar-input-select');
    await expect(field.locator('mat-error')).toBeVisible();
    await expect(field.locator('mat-error')).not.toHaveAttribute('tabindex', /.*/);
    await expect(select).toHaveAccessibleDescription(/required/);
    expect((await tabFrom(select, page))?.error).toBe(false);
  });

  test('beside a controlled term', async ({ page }) => {
    await open(page, '04-controlled-terms');
    const box = page.locator('app-cedar-input-controlled input[aria-label="organism"]');
    await box.focus();
    await box.blur();
    const error = page.locator('app-cedar-input-controlled mat-error').first();
    await expect(error).toBeVisible();
    await expect(error).not.toHaveAttribute('tabindex', /.*/);
    expect((await tabFrom(box, page))?.error).toBe(false);
  });

  test('beside an authority term', async ({ page }) => {
    await page.route('**/fixtures/08-authority.json', async (route) => {
      const template = await (await route.fetch()).json();
      template.properties._contributor_orcid._valueConstraints.requiredValue = true;
      await route.fulfill({ json: template });
    });
    await open(page, '08-authority');
    const box = page.locator('input[aria-label="contributor_orcid"]');
    await box.focus();
    await box.blur();
    const error = page.locator('app-cedar-input-orcid mat-error');
    await expect(error).toBeVisible();
    await expect(error).not.toHaveAttribute('tabindex', /.*/);
    expect((await tabFrom(box, page))?.error).toBe(false);
  });
});

test.describe('the page-break chips', () => {
  const chips = (page: Page) => page.locator('.page-break-paginator-container').getByRole('option');
  const firstPageText = (page: Page) => page.locator('cedar-embeddable-editor').getByRole('textbox', { name: 'first' });

  for (const key of ['Enter', 'Space'] as const)
    test(`turn the page on ${key}, and keep focus on the chip`, async ({ page }) => {
      await open(page, '05-static-paged');
      await expect(firstPageText(page)).toBeVisible();
      await chips(page).nth(1).focus();
      await page.keyboard.press(key);
      await expect(chips(page).nth(1)).toHaveAttribute('aria-selected', 'true');
      await expect(firstPageText(page)).toHaveCount(0);
      await expect(page.locator('cedar-embeddable-editor').getByText('second', { exact: true })).toBeVisible();
      await expect(chips(page).nth(1)).toBeFocused();
    });

  test('move focus with the arrow keys, Home and End', async ({ page }) => {
    await open(page, '05-static-paged');
    await chips(page).first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(chips(page).nth(1)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(chips(page).first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(chips(page).last()).toBeFocused();
    await expect(firstPageText(page), 'moving focus turns no page').toBeVisible();
  });

  test('still turn the page on a click', async ({ page }) => {
    await open(page, '05-static-paged');
    await chips(page).nth(1).click();
    await expect(firstPageText(page)).toHaveCount(0);
  });
});
