import { test, expect } from '@playwright/test';
import { open } from './support/host';

for (const readonly of [false, true]) {
  test(`page navigation and actions share a centerline (${readonly ? 'readonly' : 'editable'})`, async ({ page }) => {
    await open(page, '05-static-paged', readonly ? 'readonly' : undefined, undefined, undefined, '&f=showDownloadMenu');
    const toolbar = page.locator('.template-actions');
    const centers = await toolbar
      .locator('.mat-mdc-chip, .mat-mdc-paginator button svg, .expand-trigger mat-icon, .download-trigger mat-icon')
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.getBoundingClientRect().width > 0)
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return {
              group: node.closest('.expand-buttons') ? 'actions' : 'pager',
              name: node.getAttribute('aria-label') || node.textContent?.trim(),
              y: rect.y + rect.height / 2,
            };
          }),
      );
    expect(centers.length).toBeGreaterThanOrEqual(5);
    const rows =
      page.viewportSize()!.width <= 520
        ? ['pager', 'actions'].map((group) => centers.filter((c) => c.group === group))
        : [centers];
    for (const row of rows) {
      expect(
        Math.max(...row.map((c) => c.y)) - Math.min(...row.map((c) => c.y)),
        JSON.stringify(row),
      ).toBeLessThanOrEqual(1);
    }
  });
}
