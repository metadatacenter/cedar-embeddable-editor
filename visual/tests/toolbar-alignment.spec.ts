import { test, expect } from '@playwright/test';
import { open } from './support/host';

for (const readonly of [false, true]) {
  test(`page navigation and actions share a centerline (${readonly ? 'readonly' : 'editable'})`, async ({ page }) => {
    await open(page, '05-static-paged', readonly ? 'readonly' : undefined, undefined, undefined, '&f=showDownloadMenu');
    const toolbar = page.locator('.template-actions');
    for (const chip of await toolbar.locator('mat-chip-option').all()) {
      expect((await chip.boundingBox())!.height).toBe(32);
      await expect(chip.locator('.mat-mdc-chip-action-label')).toHaveCSS('font-size', '14px');
      await expect(chip.locator('.mat-mdc-chip-action-label')).toHaveCSS('line-height', '21px');
    }
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

  test(`occurrence pagination retains its geometry across densities (${readonly ? 'readonly' : 'editable'})`, async ({
    page,
  }) => {
    await open(page, '03-nested-multi', readonly ? 'readonly' : undefined);
    const editor = page.locator('cedar-embeddable-editor');
    await editor.evaluate(async (el) => {
      const template = await fetch('/fixtures/03-nested-multi.json').then((response) => response.json());
      template.properties._author.minItems = 7;
      template.properties._author.maxItems = 12;
      (el as HTMLElement & { templateObject: unknown }).templateObject = template;
    });
    const pager = editor.locator('app-cedar-multi-pager').first();
    const range = pager.locator('.mat-mdc-paginator-range-label');
    await expect(range).toHaveText('1 – 5 of 7');
    for (const density of ['compact', 'authoring', 'comfortable']) {
      await editor.evaluate((el, profile) => el.setAttribute('density', profile), density);
      for (const chip of await pager.locator('mat-chip-option').all()) {
        expect((await chip.boundingBox())!.height).toBe(26);
        await expect(chip.locator('.mat-mdc-chip-action-label')).toHaveCSS('line-height', '18px');
      }
      await expect(range).toHaveCSS('font-size', '12px');
      await expect(range).toHaveCSS('line-height', '18px');
      const container = pager.locator('.mat-mdc-paginator-container');
      expect((await container.boundingBox())!.height).toBe(56);
      for (const action of await pager.locator('.pager-actions button').all()) {
        expect((await action.boundingBox())!.height).toBe(32);
      }
    }
    await pager.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(range).toHaveText('6 – 7 of 7');
    await expect(pager.getByRole('option')).toHaveText(['6', '7']);
    await pager.getByRole('option', { name: '7', exact: true }).click();
    await expect(pager.getByRole('option', { name: '7', exact: true })).toHaveAttribute('aria-selected', 'true');
  });
}
