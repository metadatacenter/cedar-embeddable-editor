import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { open } from './support/host';
import { surfaceCases, checkSurface } from './surface-contracts.generated.mjs';
const registry = JSON.parse(readFileSync(new URL('../../.ui-surfaces.json', import.meta.url), 'utf8'));
const scenarios: Record<string, (page: Page) => Promise<void>> = {
  download: async (page: Page) => {
    await open(page, '01-input-types', undefined, undefined, undefined, '&f=showDownloadMenu');
    await page.locator('.download-trigger').click();
  },
  date: async (page: Page) => {
    await open(page, '09-temporal');
    await page.locator('mat-datepicker-toggle button').first().click();
  },
  form: async (page: Page) => {
    await open(page, '03-nested-multi');
  },
  'read-only-form': async (page: Page) => {
    await open(page, '17-real-flat', 'readonly');
  },
};
for (const { surface, state, width, title } of surfaceCases(registry, scenarios))
  test(title, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await scenarios[surface.scenario](page);
    await checkSurface(page, surface, state, expect, testInfo);
  });
