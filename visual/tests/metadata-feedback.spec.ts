import { expect, test } from '@playwright/test';
import { open } from './support/host';

test('numeric errors appear while typing and clear before leaving the field', async ({ page }, testInfo) => {
  await open(page, '17-real-flat');
  const input = page.getByRole('spinbutton', { name: 'Numeric Field', exact: true });
  const widget = page.locator('app-cedar-input-numeric').filter({ has: input });
  await input.fill('111');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(widget.locator('mat-error')).toBeVisible();
  await expect(widget.locator('mat-error')).toHaveCSS('color', 'rgb(180, 35, 24)');
  await widget.screenshot({ path: testInfo.outputPath('immediate-numeric-error.png'), animations: 'disabled' });
  await input.fill('99');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'false');
  await expect(widget.locator('mat-error')).toHaveCount(0);
});

test('a header without actions keeps the first field close to its title', async ({ page }, testInfo) => {
  await open(page, '01-input-types', undefined, undefined, undefined, '&n=showExpandCollapseAll,showDownloadMenu');
  await expect(page.locator('.template-actions')).toHaveCount(0);
  const header = page.locator('.template-header');
  const bounds = await header.boundingBox();
  expect(bounds!.height).toBeLessThan(125);
  await header.screenshot({ path: testInfo.outputPath('compact-header.png') });
});
