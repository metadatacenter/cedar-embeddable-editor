import { test, expect, type Page } from '@playwright/test';
import { open } from './support/host';

async function requireFields(page: Page, fixture: string) {
  await page.route(`**/fixtures/${fixture}.json`, async (route) => {
    const response = await route.fetch();
    const artifact = await response.json();
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const constraints = (value as Record<string, unknown>)._valueConstraints;
      if (constraints && typeof constraints === 'object') (constraints as Record<string, unknown>).requiredValue = true;
      for (const child of Object.values(value)) visit(child);
    };
    visit(artifact);
    await route.fulfill({ json: artifact });
  });
}

for (const quiet of [true, false]) {
  test(`empty text and numeric controls stay quiet=${quiet}`, async ({ page }) => {
    await requireFields(page, '01-input-types');
    await open(page, '01-input-types', undefined, undefined, undefined, quiet ? '&f=suppressEmptyFieldErrors' : '');
    for (const [name, value] of [
      ['text', 'hello'],
      ['textarea', 'hello'],
      ['numeric', '12'],
      ['email', 'a@example.org'],
      ['phone', '1234567890'],
      ['link', 'https://example.org'],
    ]) {
      const input = page.getByRole(name === 'numeric' ? 'spinbutton' : 'textbox', { name, exact: true });
      await input.fill(value);
      await input.fill('');
      await input.blur();
      const field = input.locator('xpath=ancestor::mat-form-field');
      if (quiet) {
        await expect(field).not.toHaveClass(/mat-form-field-invalid/);
        await expect(field.locator('mat-error')).toHaveCount(0);
      } else await expect(field.locator('mat-error')).toContainText('required');
    }
    const email = page.getByRole('textbox', { name: 'email', exact: true });
    await email.fill('not-an-email');
    await expect(email.locator('xpath=ancestor::mat-form-field')).toHaveClass(/mat-form-field-invalid/);
    await expect(email.locator('xpath=ancestor::mat-form-field').locator('mat-error')).toBeVisible();
  });
  test(`clearing a required checkbox and radio stays quiet=${quiet}`, async ({ page }) => {
    await requireFields(page, '02-choices');
    await open(page, '02-choices', undefined, undefined, undefined, quiet ? '&f=suppressEmptyFieldErrors' : '');
    const checkbox = page.locator('app-cedar-input-checkbox').first();
    const choice = checkbox.getByRole('checkbox').first();
    await choice.check();
    await choice.uncheck();
    await choice.blur();
    if (quiet) await expect(checkbox.locator('mat-error')).toHaveCount(0);
    else await expect(checkbox.locator('mat-error')).toBeVisible();
    const radio = page.locator('app-cedar-input-multiple-choice').first();
    await radio.getByRole('radio').first().check();
    await radio.getByRole('button', { name: 'Clear', exact: true }).click();
    if (quiet) await expect(radio.locator('mat-error')).toHaveCount(0);
    else await expect(radio.locator('mat-error')).toBeVisible();
  });
  test(`clearing required lists stays quiet=${quiet}`, async ({ page }) => {
    await requireFields(page, '02-choices');
    await open(page, '02-choices', undefined, undefined, undefined, quiet ? '&f=suppressEmptyFieldErrors' : '');
    const fields = page.locator('app-cedar-input-select');
    for (let i = 0; i < (await fields.count()); i++) {
      const field = fields.nth(i);
      const select = field.getByRole('combobox');
      await select.click();
      const multiple = (await page.getByRole('listbox').getAttribute('aria-multiselectable')) === 'true';
      const option = page.getByRole('option').first();
      await option.click();
      if (multiple) {
        await option.click();
        await page.keyboard.press('Escape');
      } else {
        await expect(page.getByRole('listbox')).toHaveCount(0);
        await field.getByRole('button', { name: 'Clear', exact: true }).click();
      }
      await select.blur();
      if (quiet) {
        await expect(field.locator('mat-form-field')).not.toHaveClass(/mat-form-field-invalid/);
        await expect(field.locator('mat-error')).toHaveCount(0);
      } else {
        await expect(field.locator('mat-error')).toContainText('required');
      }
    }
    expect(await fields.count()).toBeGreaterThan(0);
  });
  test(`clearing a complete temporal field stays quiet=${quiet}`, async ({ page }) => {
    await requireFields(page, '21-temporal-normalization');
    await open(
      page,
      '21-temporal-normalization',
      undefined,
      '21-temporal-normalization-instance',
      undefined,
      quiet ? '&f=suppressEmptyFieldErrors' : '',
    );
    const field = page.locator('app-cedar-input-datetime').nth(4);
    await field.getByRole('button', { name: 'Clear', exact: true }).click();
    if (quiet) await expect(field.locator('mat-error')).toHaveCount(0);
    else await expect(field.locator('mat-error')).toContainText('required');
    await field.getByRole('textbox', { name: 'Hour', exact: true }).fill('12');
    await expect(field.locator('mat-error')).toBeVisible();
  });
}
