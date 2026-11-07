import { expect, test } from '@playwright/test';
import { open } from './support/host';

test('CEE and CEF keep their configured language when other instances start', async ({ page }) => {
  await open(page, '01-input-types', 'readonly');
  const first = page.locator('cedar-embeddable-editor').first();
  await expect(first.locator('div:has(> app-cedar-embeddable-metadata-editor)')).toHaveAttribute('lang', 'en');
  const originalText = await first.locator('div:has(> app-cedar-embeddable-metadata-editor)').innerText();

  await page.evaluate(async () => {
    const template = await fetch('/fixtures/01-input-types.json').then((response) => response.json());
    const definition = window.ceeStandaloneField(template.properties._numeric).field;
    for (const [id, language] of [
      ['english-field', 'en'],
      ['hungarian-field', 'hu'],
    ] as const) {
      const field = document.createElement('cedar-embeddable-field');
      field.id = id;
      document.body.append(field);
      field.config = { defaultLanguage: language, fallbackLanguage: 'en', readOnlyMode: true };
      field.fieldObject = definition;
    }
    const editor = document.createElement('cedar-embeddable-editor');
    editor.id = 'hungarian-editor';
    document.body.append(editor);
    editor.config = { defaultLanguage: 'hu', fallbackLanguage: 'en', readOnlyMode: true };
    editor.templateObject = template;
  });

  await expect(page.locator('#hungarian-editor div:has(> app-cedar-embeddable-metadata-editor)')).toHaveAttribute(
    'lang',
    'hu',
  );
  await expect(page.locator('#hungarian-field .cedar-embeddable-field-root')).toHaveAttribute('lang', 'hu');
  await expect(page.locator('#english-field .cedar-embeddable-field-root')).toHaveAttribute('lang', 'en');
  await expect(first.locator('div:has(> app-cedar-embeddable-metadata-editor)')).toHaveAttribute('lang', 'en');
  await expect
    .poll(() => first.locator('div:has(> app-cedar-embeddable-metadata-editor)').innerText())
    .toBe(originalText);
  const english = await page.locator('#english-field .cee-spec-box').innerText();
  const hungarian = await page.locator('#hungarian-field .cee-spec-box').innerText();
  expect(english).not.toBe(hungarian);

  // A further English instance must not switch either Hungarian instance back.
  await page.evaluate(async () => {
    const template = await fetch('/fixtures/01-input-types.json').then((response) => response.json());
    const field = document.createElement('cedar-embeddable-field');
    field.id = 'later-english-field';
    document.body.append(field);
    field.config = { defaultLanguage: 'en', fallbackLanguage: 'en', readOnlyMode: true };
    field.fieldObject = window.ceeStandaloneField(template.properties._numeric).field;
  });
  await expect(page.locator('#later-english-field .cee-spec-box')).toHaveText(english);
  await expect(page.locator('#hungarian-field .cee-spec-box')).toHaveText(hungarian);
  await expect(page.locator('#hungarian-editor div:has(> app-cedar-embeddable-metadata-editor)')).toHaveAttribute(
    'lang',
    'hu',
  );
});
