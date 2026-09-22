import { expect, test } from '@playwright/test';
import { open } from './support/host';

for (const host of ['', '&host=field&p=_single_list']) {
  test(`dropdown options use shared menu density ${host || 'CEE'}`, async ({ page }) => {
    await open(page, '02-choices', undefined, undefined, undefined, host);
    await page.locator('mat-select').first().click();
    await expect(page.locator('.mat-mdc-select-panel')).toHaveCSS('padding-top', '4px');
    await expect(page.locator('.mat-mdc-select-panel')).toHaveCSS('padding-bottom', '4px');
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    for (const option of await options.all()) {
      await expect(option).toHaveCSS('min-height', '28px');
      await expect.poll(async () => (await option.boundingBox())!.height).toBe(28);
    }
    const label = options.first().locator('.mdc-list-item__primary-text');
    await label.evaluate((node) => {
      node.textContent = 'A long descriptive option label '.repeat(30);
    });
    await expect.poll(async () => (await options.first().boundingBox())!.height).toBeGreaterThan(28);
    await page.keyboard.press('Escape');
    await expect(options.first()).toBeHidden();
  });
}
