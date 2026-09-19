import { test, expect } from '@playwright/test';
import { open } from './support/host';

for (const host of ['editor', 'field']) {
  test(`manual textarea resizing is disabled in ${host}`, async ({ page }) => {
    await open(
      page,
      '01-input-types',
      undefined,
      undefined,
      undefined,
      host === 'field' ? '&host=field&p=_textarea' : '',
    );
    const textarea = page.locator('textarea[aria-label="textarea"]');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveCSS('resize', 'none');
    await textarea.fill(Array.from({ length: 12 }, (_, i) => `Line ${i}`).join('\n'));
    await expect(textarea).toHaveValue(/Line 11/);
    await expect(textarea).toHaveCSS('resize', 'none');
  });
}
