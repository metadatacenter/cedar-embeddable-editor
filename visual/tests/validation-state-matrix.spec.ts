import { expect, test } from '@playwright/test';
import { draftContexts, draftTemplate } from '../../harness/src/validation-state-fixtures';
import { changeDetails, currentMetadata, open, recordChanges } from './support/host';

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
          .getByRole('button', { name: 'Add empty instance here', exact: true })
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
    // Every occurrence carries its level's `@context`, as a stored one does.
    const contexts = draftContexts(template, depth);
    const occurrence = (value: object) => ({ '@context': contexts[depth - 1], _f: value });
    let values: Record<string, unknown> = {
      [`_level${depth - 1}`]: [
        occurrence({ '@value': 'not a date' }),
        occurrence({ '@value': null, '@type': 'xsd:dateTime' }),
      ],
    };
    for (let level = depth - 2; level >= 0; level--)
      values = { [`_level${level}`]: [{ '@context': contexts[level], ...values }] };
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
    // A host enables Save from this verdict, and a value the field cannot read blocks it.
    expect(
      await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport),
    ).toMatchObject({ structurallyValid: false, canSave: false });
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
    expect(
      await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport),
    ).toMatchObject({ structurallyValid: true, canSave: true });
  });
}

for (const depth of [1, 3, 6]) {
  test(`a malformed element at depth ${depth} can be located and repaired`, async ({ page }) => {
    const template = draftTemplate(depth, 'text');
    // Every occurrence carries its level's `@context`, as a stored one does. Beside an occurrence that
    // carries one, a value is refused when read, so the malformed occurrence is the only entry of its
    // list.
    const contexts = draftContexts(template, depth);
    let values: Record<string, unknown> = { [`_level${depth - 1}`]: [{ '@value': 'not an element' }] };
    for (let level = depth - 2; level >= 0; level--)
      values = { [`_level${level}`]: [{ '@context': contexts[level], ...values }] };
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
    const opened = await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport);
    const problem = opened.problems.find((p) => p.code === 'valueShape');
    expect(problem?.severity).toBe('error');
    // Malformed data blocks a save, which a host reads from `canSave`.
    expect(opened).toMatchObject({ structurallyValid: false, canSave: false });
    expect(
      await page.evaluate((where) => document.querySelector('cedar-embeddable-editor')!.reveal(where!), problem),
    ).toBe(true);
    await expect(page.getByText('This element contains malformed data.', { exact: false })).toBeVisible();
    await recordChanges(page);
    await page.locator('app-cedar-input-text input').fill('repaired');
    // The repaired list holds one of the two occurrences its element requires, which is a warning
    // rather than malformed data. The form is incomplete, and it can be saved.
    await expect
      .poll(async () => {
        const report = (await changeDetails(page)).at(-1)?.dataQualityReport;
        return (
          report && {
            codes: report.problems.map((problem) => problem.code),
            valid: report.isValid,
            save: report.canSave,
          }
        );
      })
      .toEqual({ codes: ['minItems'], valid: false, save: true });
    expect(
      await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport),
    ).toMatchObject({ isValid: false, structurallyValid: true, canSave: true });
    await expect(page.getByText('This element contains malformed data.', { exact: false })).toHaveCount(0);
  });
}

test('offers no save of an instance whose template has never been saved', async ({ page }) => {
  // Only a saved template has an identifier, so an instance of an unsaved one names no template.
  // Neither writer can write it, and the host receives the empty object as its metadata.
  const unsaved: Record<string, unknown> = { ...draftTemplate(1, 'text') };
  delete unsaved['@id'];
  await page.route('**/fixtures/validation-state.json', (route) => route.fulfill({ json: unsaved }));
  await open(page, 'validation-state');
  expect(await currentMetadata(page)).toEqual({});
  expect(await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport.canSave)).toBe(
    false,
  );
});
