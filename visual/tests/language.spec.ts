import { expect, test, type Locator, type Page } from '@playwright/test';
import { open } from './support/host';

/**
 * WCAG 3.1.2, Language of Parts: CEE's own text is marked with the language it is shown in, and a
 * value an instance tags with `@language` is marked with that tag where CEE shows it as text.
 *
 * The host page is English. Each element renders into a shadow root, where a `lang` on the root
 * reaches everything the form draws. Overlays and tooltip descriptions sit beside the root rather
 * than inside it, so they carry the attribute themselves.
 */

/** The `div` each element renders everything else into. */
const editorRoot = (page: Page): Locator =>
  page.locator('cedar-embeddable-editor').locator('div:has(> app-cedar-embeddable-metadata-editor)');
const fieldRoot = (page: Page): Locator =>
  page.locator('cedar-embeddable-field').locator('.cedar-embeddable-field-root');
const inEditor = (page: Page, selector: string): Locator => page.locator('cedar-embeddable-editor').locator(selector);

for (const [preset, language] of [
  [undefined, 'en'],
  ['hu', 'hu'],
] as const) {
  test(`the editor marks its root, its overlays and its descriptions as ${language}`, async ({ page }) => {
    await open(page, '02-choices', preset);
    await expect(editorRoot(page)).toHaveAttribute('lang', language);
    // Descriptions are registered as tooltips are, on load.
    await expect(inEditor(page, '.cdk-describedby-message-container')).toHaveAttribute('lang', language);
    await page.locator('mat-select').first().click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(inEditor(page, '.cee-overlay-container')).toHaveAttribute('lang', language);
  });
}

/**
 * Material's own text is English whatever the form's language: CEE translates neither its paginator
 * nor its datepicker, and the calendar names months in the default locale. In a Hungarian form the
 * elements drawing it are marked as English.
 */
test("Material's English paginator and calendar are marked as English in a Hungarian form", async ({ page }) => {
  await open(page, '05-static-paged', 'hu');
  await expect(editorRoot(page)).toHaveAttribute('lang', 'hu');
  await expect(inEditor(page, 'mat-paginator')).toHaveAttribute('lang', 'en');

  await open(page, '09-temporal', 'hu');
  const toggle = inEditor(page, 'mat-datepicker-toggle').first();
  await expect(toggle).toHaveAttribute('lang', 'en');
  await toggle.locator('button').click();
  await expect(inEditor(page, '.mat-datepicker-content')).toHaveAttribute('lang', 'en');
});

/** A second editor or field, configured as a host would, whose first configuration is the one under test. */
const freshElement = async (
  page: Page,
  tag: 'cedar-embeddable-editor' | 'cedar-embeddable-field',
  defaultLanguage: string,
): Promise<void> => {
  await page.evaluate(
    async ({ tag, defaultLanguage }) => {
      const template = await (await fetch('./fixtures/01-input-types.json')).json();
      const frame = document.querySelector('#frame')!;
      frame.replaceChildren();
      const element = document.createElement(tag);
      frame.appendChild(element);
      Object.assign(element, { config: { defaultLanguage, fallbackLanguage: 'en' } });
      Object.assign(
        element,
        tag === 'cedar-embeddable-field' ? { fieldObject: template.properties._text } : { templateObject: template },
      );
    },
    { tag, defaultLanguage },
  );
};

test('a configured language with no map of its own is marked as the English it is shown in', async ({ page }) => {
  await open(page, '01-input-types');
  await freshElement(page, 'cedar-embeddable-editor', 'fr');
  await expect(page.getByRole('button', { name: 'Expand All', exact: true })).toBeVisible();
  await expect(editorRoot(page)).toHaveAttribute('lang', 'en');
});

test('a language spelled as a map name is marked as a language tag', async ({ page }) => {
  await open(page, '01-input-types');
  // `hu_HU` names no built-in map either, so its text is English.
  await freshElement(page, 'cedar-embeddable-editor', 'hu_HU');
  await expect(page.getByRole('button', { name: 'Expand All', exact: true })).toBeVisible();
  await expect(editorRoot(page)).toHaveAttribute('lang', 'en');
});

test('the field element marks its root with its configured language', async ({ page }) => {
  await open(page, '01-input-types');
  await freshElement(page, 'cedar-embeddable-field', 'hu');
  await expect(fieldRoot(page)).toHaveAttribute('lang', 'hu');
  await expect(fieldRoot(page).getByRole('textbox', { name: 'text', exact: true })).toBeVisible();
});

/**
 * Spellchecking is the one behaviour a `lang` changes inside a text box: it chooses the dictionary.
 * Every box CEE draws turns spellchecking off, so marking the root switches no dictionary for what
 * a user types, and no box needs to keep the language it inherited from the page.
 */
for (const fixture of ['01-input-types', '08-authority', '09-temporal', '10-attribute-values'])
  test(`no text box in ${fixture} spellchecks, so the marked language changes no dictionary`, async ({ page }) => {
    await open(page, fixture, 'hu');
    await expect(editorRoot(page)).toHaveAttribute('lang', 'hu');
    const boxes = page.locator('cedar-embeddable-editor').locator('input, textarea');
    expect(await boxes.count()).toBeGreaterThan(0);
    for (const box of await boxes.all()) await expect(box).toHaveJSProperty('spellcheck', false);
  });

/** The input-types instance, holding tagged text in three fields and untagged text in a fourth. */
const assignTaggedInstance = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    const instance = await (await fetch('./fixtures/01-input-types-instance.json')).json();
    Object.assign(instance, {
      _text: { '@value': 'Guten Tag', '@language': 'de' },
      _textarea: { '@value': 'Bonjour à tous' },
      _email: { '@value': 'kapcsolat@example.org', '@language': 'hu' },
      _phone: { '@value': '+36 1 234 5678', '@language': 'not a tag' },
    });
    Object.assign(document.querySelector('cedar-embeddable-editor')!, { instanceObject: instance });
  });

test('a read-only value is marked with the language its instance tags it with', async ({ page }) => {
  await open(page, '01-input-types', 'readonly');
  await assignTaggedInstance(page);
  const editor = page.locator('cedar-embeddable-editor');
  const text = editor.getByRole('textbox', { name: 'text', exact: true });
  await expect(text).toHaveValue('Guten Tag');
  await expect(text).toHaveAttribute('lang', 'de');
  await expect(editor.getByRole('textbox', { name: 'email', exact: true })).toHaveAttribute('lang', 'hu');
  // Untagged text inherits CEE's language, and a malformed tag is not asserted.
  await expect(editor.getByRole('textbox', { name: 'textarea', exact: true })).toHaveValue('Bonjour à tous');
  await expect(editor.getByRole('textbox', { name: 'textarea', exact: true })).not.toHaveAttribute('lang', /.*/);
  await expect(editor.getByRole('textbox', { name: 'phone', exact: true })).not.toHaveAttribute('lang', /.*/);
});

test('an editable box holding tagged text is not marked, because what it holds is being typed', async ({ page }) => {
  await open(page, '01-input-types');
  await assignTaggedInstance(page);
  const text = page.locator('cedar-embeddable-editor').getByRole('textbox', { name: 'text', exact: true });
  await expect(text).toHaveValue('Guten Tag');
  await expect(text).not.toHaveAttribute('lang', /.*/);
});
