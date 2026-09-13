import { test, expect } from '@playwright/test';
import { BUNDLE_VERSION, open } from './support/host';

test('compact CEF matches read-only height and stays compact after typing and clearing', async ({ page }) => {
  await page.goto(`/host.html?host=field&t=01-input-types&p=_text&b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => window.__ceeReady);
  const field = page.locator('cedar-embeddable-field');
  await field.evaluate((el) => el.setAttribute('density', 'compact'));
  const box = field.locator('.mat-mdc-text-field-wrapper').first();
  await expect(box).toBeVisible();
  await expect.poll(async () => (await box.boundingBox())!.height).toBe(36);
  await field.locator('input').fill('A compact value');
  await expect.poll(async () => (await box.boundingBox())!.height).toBe(36);
  await expect(field.locator('input')).toHaveCSS('font-size', '14px');
  await field.getByRole('button', { name: /Clear/i }).click();
  await expect.poll(async () => (await box.boundingBox())!.height).toBe(36);
  const referencePage = await page.context().newPage();
  await open(referencePage, '01-input-types', 'readonly');
  const reference = referencePage.locator('.cee-spec-box').first();
  await expect(reference).toBeVisible();
  expect((await reference.boundingBox())!.height).toBe((await box.boundingBox())!.height);
  await referencePage.close();
  // Public tokens cross the shadow boundary, and changing density preserves values.
  await field.locator('input').fill('Retained');
  await field.evaluate((el) => el.style.setProperty('--cedar-control-height', '40px'));
  await expect.poll(async () => (await box.boundingBox())!.height).toBe(40);
  await expect(field.locator('input')).toHaveValue('Retained');
});

test('editable compact CEE uses the same box height and keeps temporal placeholders whole', async ({ page }) => {
  await open(page, '09-temporal');
  const editor = page.locator('cedar-embeddable-editor');
  await editor.evaluate((el) => el.setAttribute('density', 'compact'));
  const clocks = editor.locator('.cee-time-input-shell');
  await expect(clocks.first()).toBeVisible();
  for (const clock of await clocks.all()) {
    expect((await clock.boundingBox())!.height).toBe(36);
    for (const segment of await clock.locator('input').all()) {
      const fit = await segment.evaluate((el: HTMLInputElement) => {
        const style = getComputedStyle(el);
        const canvas = document.createElement('canvas').getContext('2d')!;
        canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return {
          available: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          needed: canvas.measureText(el.placeholder).width,
        };
      });
      expect(fit.needed).toBeLessThanOrEqual(fit.available);
    }
  }
  for (const box of await editor.locator('.mat-mdc-text-field-wrapper').all()) {
    if (await box.isVisible()) expect((await box.boundingBox())!.height).toBe(36);
  }
});

test('compact paragraphs start with two rows and grow without clipping content', async ({ page }) => {
  await page.goto(`/host.html?host=field&t=01-input-types&p=_textarea&b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => window.__ceeReady);
  const field = page.locator('cedar-embeddable-field');
  await field.evaluate((el) => el.setAttribute('density', 'compact'));
  const input = field.locator('textarea');
  await expect(input).toBeVisible();
  await expect.poll(async () => (await input.boundingBox())!.height).toBeLessThanOrEqual(50);
  await input.fill('One\nTwo\nThree\nFour\nFive');
  await expect.poll(async () => (await input.boundingBox())!.height).toBeGreaterThan(90);
  await expect(input).toHaveValue('One\nTwo\nThree\nFour\nFive');
});
