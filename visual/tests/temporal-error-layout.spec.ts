import { test, expect } from '@playwright/test';
import { open } from './support/host';

for (const host of ['editor', 'field']) {
  test(`invalid time feedback (${host}) does not displace fractional seconds`, async ({ page }) => {
    await page.route('**/fixtures/09-temporal.json', async (route) => {
      const response = await route.fetch();
      const template = await response.json();
      template.properties._decimal_seconds._ui.inputTimeFormat = '12h';
      template.properties._decimal_seconds._ui.timezoneEnabled = true;
      await route.fulfill({ response, json: template });
    });
    await open(
      page,
      '09-temporal',
      undefined,
      undefined,
      undefined,
      host === 'field' ? '&host=field&p=_decimal_seconds' : '',
    );
    const field = page
      .locator('app-cedar-input-datetime')
      .filter({ has: page.locator('.cee-fraction-field') })
      .first();
    const fraction = field.locator('.cee-fraction-field');
    const before = await fraction.boundingBox();
    const hour = field.getByRole('textbox', { name: 'Hour', exact: true });
    await hour.fill('99');
    await hour.blur();
    await expect(field.getByRole('status')).toBeVisible();
    const after = await fraction.boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    const feedback = await field.getByRole('status').boundingBox();
    const clock = await field.locator('.cee-time-input-shell').boundingBox();
    expect(feedback!.y).toBeGreaterThanOrEqual(clock!.y + clock!.height);
    await expect(field).toHaveScreenshot(`fractional-time-error-${host}.png`);
  });
}
