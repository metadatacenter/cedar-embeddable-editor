import { test, expect } from '@playwright/test';
import { open } from './support/host';

for (const host of ['editor', 'field']) {
  test(`browser spellchecking stays off in embedded ${host}`, async ({ page }) => {
    await open(
      page,
      '01-input-types',
      undefined,
      undefined,
      undefined,
      host === 'field' ? '&host=field&p=_textarea' : '',
    );
    // A host's browser preference must not leak into either shadow-root entry point.
    await page.locator('body').evaluate((body) => body.setAttribute('spellcheck', 'true'));
    const controls = page.locator('input, textarea');
    expect(await controls.count()).toBeGreaterThan(0);
    for (const control of await controls.all()) {
      await expect(control).toHaveAttribute('spellcheck', 'false');
      await expect(control).toHaveJSProperty('spellcheck', false);
    }
  });
}

test('scientific authority names do not enable browser spelling', async ({ page }) => {
  await open(page, '08-authority');
  const pfas = page.locator('input[aria-label="chemical_pfas"]');
  await expect(pfas).toBeVisible();
  await expect(pfas).toHaveAttribute('spellcheck', 'false');
  await expect(pfas).toHaveJSProperty('spellcheck', false);
});
