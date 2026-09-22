import { expect, test } from '@playwright/test';
import { open } from './support/host';

for (const property of ['_single_list', '_bounded_list']) {
  for (const standalone of [false, true]) {
    test(`${property} summary uses middle dots (${standalone ? 'CEF' : 'CEE'})`, async ({ page }) => {
      await open(page, '02-choices', 'readonly', undefined, undefined, standalone ? `&host=field&p=${property}` : '');
      const labels = property === '_single_list' ? ['Red', 'Green', 'Blue'] : ['Up', 'Down', 'Sideways'];
      const options = page.locator('.cee-spec-box-options').filter({ hasText: labels[0] }).first();
      await expect(options).toContainText(labels.join(' · '));
      await expect(options).not.toContainText(labels.join(', '));
    });
  }
}
