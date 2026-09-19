import { expect, test } from '@playwright/test';
import { open } from './support/host';

for (const property of [
  '_contributor_orcid',
  '_institution_ror',
  '_chemical_pfas',
  '_citation_pmid',
  '_resource_rrid',
  '_award_nih',
  '_dataset_doi',
]) {
  test(`${property} reports searching until the lookup completes`, async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('http://127.0.0.1:9/**', async (route) => {
      await pending;
      await route.fulfill({ json: { found: false, results: {} } });
    });
    await open(page, '08-authority', undefined, undefined, undefined, `&host=field&p=${property}`);
    const field = page.locator('cedar-embeddable-field');
    await field.locator('input').first().fill('Unmatched example');
    await expect(field.getByText('Searching…', { exact: true })).toBeVisible();
    await expect(field.getByText('No results found', { exact: true })).toHaveCount(0);
    release();
    await expect(field.getByText('No results found', { exact: true })).toBeVisible();
    await expect(field.getByText('Searching…', { exact: true })).toHaveCount(0);
  });
}
