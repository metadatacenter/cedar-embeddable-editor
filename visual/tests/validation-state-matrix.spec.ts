import { expect, test } from '@playwright/test';
import { draftTemplate } from '../../harness/src/validation-state-fixtures';
import { changeDetails, open, recordChanges } from './support/host';

for (const depth of [1, 3, 6]) {
  for (const type of ['temporal', 'attrValue'] as const) {
    test(`${type} draft survives navigation at depth ${depth} and notifies its host`, async ({ page }) => {
      await page.route('**/fixtures/validation-state.json', (route) =>
        route.fulfill({ json: draftTemplate(depth, type) }),
      );
      await open(page, 'validation-state');
      const path = Array.from({ length: depth }, (_, index) => `_level${index}`).concat('_f');
      const location = (last: number) => ({
        path,
        occurrences: Array.from({ length: depth }, (_, index) => (index === depth - 1 ? last : 0)),
      });
      const reveal = (last: number) =>
        page.evaluate((where) => document.querySelector('cedar-embeddable-editor')!.reveal(where), location(last));
      expect(await reveal(0)).toBe(true);
      await recordChanges(page);
      if (type === 'temporal') {
        await page.getByRole('textbox', { name: 'Hour', exact: true }).fill('14');
        await page.getByRole('textbox', { name: 'Minute', exact: true }).fill('30');
      } else {
        // The field starts with no rows; add one, as a user would, and leave it unnamed.
        await page
          .locator('app-cedar-component-renderer')
          .filter({ hasNot: page.locator('app-cedar-component-renderer') })
          .getByRole('button', { name: 'Add empty after current', exact: true })
          .click();
        expect(
          (await page.getByRole('textbox', { name: 'Attribute Value', exact: true }).boundingBox())!.width,
        ).toBeGreaterThan(60);
        await page.getByRole('textbox', { name: 'Attribute Value', exact: true }).fill('unfinished value');
      }
      const code = type === 'temporal' ? 'incompleteValue' : 'attributeName';
      await expect
        .poll(async () =>
          (await changeDetails(page))
            .at(-1)
            ?.dataQualityReport.problems.some((p) => p.code === code && p.severity === 'error'),
        )
        .toBe(true);
      const report = await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport);
      const beforeNavigation = (await changeDetails(page)).length;
      expect(await reveal(1)).toBe(true);
      expect(await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport)).toEqual(
        report,
      );
      expect(await reveal(0)).toBe(true);
      expect((await changeDetails(page)).length).toBe(beforeNavigation);
      if (type === 'temporal') {
        await expect(page.getByRole('textbox', { name: 'Hour', exact: true })).toHaveValue('14');
        await expect(page.getByRole('textbox', { name: 'Minute', exact: true })).toHaveValue('30');
        await page.locator('app-cedar-input-datetime').getByRole('button', { name: 'Clear', exact: true }).click();
      } else {
        await expect(page.getByRole('textbox', { name: 'Attribute Value', exact: true })).toHaveValue(
          'unfinished value',
        );
        await page.getByRole('textbox', { name: 'Attribute Name', exact: true }).fill('finished');
      }
      await expect
        .poll(async () =>
          (await changeDetails(page)).at(-1)?.dataQualityReport.problems.filter((p) => p.severity === 'error'),
        )
        .toEqual([]);
      expect((await changeDetails(page)).length).toBeGreaterThan(beforeNavigation);
    });
  }
}

for (const depth of [1, 6]) {
  test(`an unreadable temporal value at depth ${depth} can be cleared`, async ({ page }) => {
    const template = draftTemplate(depth, 'temporal');
    let values: Record<string, unknown> = { _f: { '@value': 'not a date' } };
    for (let level = depth - 1; level >= 0; level--)
      values = { [`_level${level}`]: level === depth - 1 ? [values, {}] : [values] };
    await page.route('**/fixtures/validation-state.json', (route) => route.fulfill({ json: template }));
    await page.route('**/fixtures/validation-state-instance.json', (route) =>
      route.fulfill({
        json: {
          '@context': {},
          'schema:isBasedOn': 'https://example.org/template/draft-matrix',
          ...values,
        },
      }),
    );
    await open(page, 'validation-state', undefined, 'validation-state-instance');
    const path = Array.from({ length: depth }, (_, index) => `_level${index}`).concat('_f');
    expect(
      await page.evaluate(
        (where) =>
          document
            .querySelector('cedar-embeddable-editor')!
            .reveal({ path: where, occurrences: Array(where.length - 1).fill(0) }),
        path,
      ),
    ).toBe(true);
    await expect(
      page.locator('app-cedar-input-datetime').getByRole('button', { name: 'Clear', exact: true }),
    ).toBeVisible();
    await page.locator('app-cedar-input-datetime').getByRole('button', { name: 'Clear', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport.problems))
      .toEqual([]);
  });
}

for (const depth of [1, 3, 6]) {
  test(`a malformed element at depth ${depth} can be located and repaired`, async ({ page }) => {
    let values: object = { '@value': 'not an element' };
    for (let level = depth - 1; level >= 0; level--)
      values = { [`_level${level}`]: level === depth - 1 ? [{}, values] : [values] };
    await page.route('**/fixtures/validation-state.json', (route) =>
      route.fulfill({ json: draftTemplate(depth, 'text') }),
    );
    await page.route('**/fixtures/validation-state-instance.json', (route) =>
      route.fulfill({
        json: {
          '@context': {},
          'schema:isBasedOn': 'https://example.org/template/draft-matrix',
          ...values,
        },
      }),
    );
    await open(page, 'validation-state', undefined, 'validation-state-instance');
    const problem = await page.evaluate(() =>
      document
        .querySelector('cedar-embeddable-editor')!
        .dataQualityReport.problems.find((p) => p.code === 'valueShape'),
    );
    expect(problem?.severity).toBe('error');
    expect(
      await page.evaluate((where) => document.querySelector('cedar-embeddable-editor')!.reveal(where!), problem),
    ).toBe(true);
    await expect(page.getByText('This element contains malformed data.', { exact: false })).toBeVisible();
    await recordChanges(page);
    await page.locator('app-cedar-input-text input').fill('repaired');
    await expect.poll(async () => (await changeDetails(page)).at(-1)?.dataQualityReport.isValid).toBe(true);
    await expect(page.getByText('This element contains malformed data.', { exact: false })).toHaveCount(0);
  });
}
