import { expect, test } from '@playwright/test';
import { open } from './support/host';

for (const standalone of [false, true]) {
  test(`read-only specification honors host geometry and wraps (${standalone ? 'CEF' : 'CEE'})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await open(page, '02-choices', 'readonly', undefined, undefined, standalone ? '&host=field&p=_single_list' : '');
    const box = page.locator('.cee-spec-box').first();
    await expect(box).toBeVisible();
    await expect(box).toHaveCSS('min-height', '36px');
    await expect(box).toHaveCSS('border-radius', '4px');
    await box.evaluate((el) => {
      const host = (el.getRootNode() as ShadowRoot).host as HTMLElement;
      host.style.setProperty('--cedar-control-height', '44px');
      host.style.setProperty('--cedar-control-radius', '7px');
      host.style.setProperty('--cedar-specification-text', 'rgb(42, 70, 91)');
      host.style.setProperty('--cedar-specification-padding-inline', '18px');
    });
    await expect(box).toHaveCSS('min-height', '44px');
    await expect(box).toHaveCSS('border-radius', '7px');
    await expect(box).toHaveCSS('color', 'rgb(42, 70, 91)');
    await expect(box).toHaveCSS('padding-left', '18px');
    expect(await box.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
}
