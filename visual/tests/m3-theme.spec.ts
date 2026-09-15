import { expect, test } from '@playwright/test';
import { BUNDLE_VERSION, open } from './support/host';

for (const host of ['editor', 'field'] as const) {
  test(`M3 ${host} preserves compact overrides and comfortable focus`, async ({ page }) => {
    await page.goto(
      `/host.html?t=06-validation${host === 'field' ? '&host=field&p=_short_text' : ''}&b=${BUNDLE_VERSION}`,
    );
    await page.waitForFunction(() => window.__ceeReady);
    const element = page.locator(`cedar-embeddable-${host}`);
    const input = element.locator('input[aria-label="short_text"]');
    await expect(input).toBeVisible();
    const box = input.locator('xpath=ancestor::mat-form-field').locator('.mat-mdc-text-field-wrapper');
    const outline = box.locator('.mdc-notched-outline__leading');
    await element.evaluate((el) => {
      el.style.setProperty('--cedar-control-height', '44px');
      el.style.setProperty('--cedar-control-font-size', '16px');
      el.style.setProperty('--cedar-control-line-height', '24px');
      el.style.setProperty('--cedar-control-radius', '9px');
      el.style.setProperty('--cedar-control-border', '#654321');
      el.style.setProperty('--cedar-control-focus', '#663399');
      el.style.setProperty('--cedar-control-error', '#993311');
    });
    await expect(input).toHaveCSS('font-size', '16px');
    await expect(input).toHaveCSS('line-height', '24px');
    await expect.poll(async () => (await box.boundingBox())!.height).toBe(44);
    await expect(outline).toHaveCSS('border-top-left-radius', '9px');
    await expect(outline).toHaveCSS('border-top-color', 'rgb(101, 67, 33)');
    await input.fill('Retained');
    await expect(outline).toHaveCSS('border-top-color', 'rgb(102, 51, 153)');
    await input.fill('abc');
    await input.blur();
    await expect(element.locator('mat-error').first()).toHaveCSS('color', 'rgb(153, 51, 17)');
    await expect(outline).toHaveCSS('border-top-color', 'rgb(153, 51, 17)');
    await input.fill('Retained');
    await element.evaluate((el) => el.setAttribute('density', 'comfortable'));
    await expect.poll(async () => (await box.boundingBox())!.height).toBe(48);
    await expect(input).toHaveCSS('font-size', '14px');
    await expect(input).toHaveValue('Retained');
    await expect(outline).toHaveCSS('border-top-color', 'rgb(15, 118, 134)');
  });
}

test('M3 select and calendar overlays retain CEDAR typography under a host reset', async ({ page }) => {
  await open(page, '02-choices');
  await page.addStyleTag({ content: 'html { font-size: 10px; color-scheme: dark; }' });
  await page.locator('mat-select').first().click();
  const option = page.locator('mat-option').first();
  await expect(option).toBeVisible();
  await expect(option).toHaveCSS('font-size', '14px');
  await expect(option).toHaveCSS('font-family', '"CEE Roboto", "Helvetica Neue", sans-serif');
  await expect(page.locator('.mat-mdc-select-panel')).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await open(page, '09-temporal');
  await page.addStyleTag({ content: 'html { font-size: 10px; color-scheme: dark; }' });
  await page.locator('mat-datepicker-toggle button').first().click();
  const calendar = page.locator('mat-calendar');
  await expect(calendar).toBeVisible();
  await expect(calendar).toHaveCSS('font-family', '"CEE Roboto", "Helvetica Neue", sans-serif');
  await expect(calendar.locator('.mat-calendar-body-cell-content').first()).toHaveCSS('font-size', '14px');
  await expect(page.locator('.mat-datepicker-content')).toHaveCSS('background-color', 'rgb(245, 245, 245)');
  await expect(calendar).toHaveScreenshot('m3-calendar.png');
});
