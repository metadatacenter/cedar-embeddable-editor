/**
 * Every combination of the presentation settings, in both elements.
 *
 * Each setting has a test of its own, and a few have one beside a second setting, but a host sets
 * them together: a designer's preview is read-only, titled by the host and quiet about empty
 * fields at once. A setting can work alone and be cancelled or overridden by another, so this
 * renders every combination and holds each setting to its own effect in all of them.
 *
 * The editor's form carries a template description, a required text field and a rich-text block
 * whose markup the sanitizer would change, which between them give every setting something to
 * act on. The field element renders the text field and the rich-text block on their own.
 */
import { test, expect, type Page } from '@playwright/test';
import { BUNDLE_VERSION, open } from './support/host';

/** All 2^n assignments of the named boolean settings. */
function combinations<K extends string>(keys: readonly K[]): Record<K, boolean>[] {
  return Array.from(
    { length: 2 ** keys.length },
    (_, bits) =>
      Object.fromEntries(keys.map((key, index) => [key, Boolean(bits & (1 << index))])) as Record<K, boolean>,
  );
}
const describe = (settings: Record<string, boolean>) =>
  Object.entries(settings)
    .map(([key, on]) => `${on ? '+' : '-'}${key}`)
    .join(' ');
/** Both ends of each setting are stated, since a default of true makes absence the on state. */
const flags = (settings: Record<string, boolean>) => {
  const on = Object.keys(settings).filter((key) => settings[key]);
  const off = Object.keys(settings).filter((key) => !settings[key]);
  return `${on.length ? `&f=${on.join(',')}` : ''}${off.length ? `&n=${off.join(',')}` : ''}`;
};
const shadowHtml = (page: Page, element: string) =>
  page.evaluate((element) => document.querySelector(element)!.shadowRoot!.innerHTML, element);

/** The editor's input fixture with the markup fixture's rich-text block added after its fields. */
async function formWithMarkup(page: Page): Promise<void> {
  await page.route('**/fixtures/01-input-types.json', async (route) => {
    const form = await (await route.fetch()).json();
    const markup = await (await page.request.get(`/fixtures/19-template-markup.json`)).json();
    form.properties._note = markup.properties._note;
    form._ui.order.push('_note');
    form._ui.propertyLabels._note = markup._ui.propertyLabels._note;
    form._ui.propertyDescriptions._note = markup._ui.propertyDescriptions._note;
    await route.fulfill({ json: form });
  });
}

const EDITOR_SETTINGS = [
  'readOnlyMode',
  'previewMode',
  'showTemplateDescription',
  'showFieldType',
  'suppressEmptyFieldErrors',
  'showDownloadMenu',
  'showExpandCollapseAll',
  'trustTemplateRichText',
] as const;

test.describe('the editor under every combination of its presentation settings', () => {
  for (const settings of combinations(EDITOR_SETTINGS)) {
    test(describe(settings), async ({ page }) => {
      await formWithMarkup(page);
      await open(page, '01-input-types', undefined, undefined, undefined, flags(settings));
      const editor = page.locator('cedar-embeddable-editor');

      // The identity header is the host's to replace; the description is the host's to ask for.
      await expect(editor.locator('.template-title-block')).toHaveCount(settings.previewMode ? 0 : 1);
      await expect(editor.locator('.logo-block')).toHaveCount(settings.previewMode ? 0 : 1);
      await expect(editor.locator('.template-description')).toHaveCount(settings.showTemplateDescription ? 1 : 0);
      if (settings.showTemplateDescription)
        await expect(editor.locator('.template-description')).toHaveText('Every simple input type');

      // The form's own controls, each present exactly when asked for.
      await expect(editor.locator('.download-trigger')).toHaveCount(settings.showDownloadMenu ? 1 : 0);
      await expect(editor.getByRole('button', { name: 'Expand All', exact: true })).toHaveCount(
        settings.showExpandCollapseAll ? 1 : 0,
      );
      await expect(editor.locator('.template-actions')).toHaveCount(
        settings.showDownloadMenu || settings.showExpandCollapseAll ? 1 : 0,
      );

      // A field's type is stated only by the field element; the editor's header icon already names it.
      await expect(editor.locator('.cee-field-type')).toHaveCount(0);

      // Rich text is verbatim only when the host trusts template authors.
      const html = await shadowHtml(page, 'cedar-embeddable-editor');
      expect(html.includes('<iframe'), 'iframe in the rich text').toBe(settings.trustTemplateRichText);
      expect(html, 'markup that survives sanitizing').toContain('styled text');

      const text = editor.getByRole('textbox', { name: 'text', exact: true });
      if (settings.readOnlyMode) {
        // With no instance behind it, a read-only form states each field's specification instead.
        await expect(text).toHaveCount(0);
        await expect(editor.locator('mat-error')).toHaveCount(0);
        return;
      }
      await expect(text).toBeEditable();
      await text.fill('value');
      await text.fill('');
      await text.blur();
      const error = text.locator('xpath=ancestor::mat-form-field').locator('mat-error');
      if (settings.suppressEmptyFieldErrors) await expect(error).toHaveCount(0);
      else await expect(error).toContainText('required');
    });
  }
});

const FIELD_SETTINGS = [
  'readOnlyMode',
  'previewMode',
  'showFieldType',
  'suppressEmptyFieldErrors',
  'trustTemplateRichText',
] as const;

const openField = async (page: Page, fixture: string, property: string, settings: Record<string, boolean>) => {
  await page.goto(`/host.html?host=field&t=${fixture}&p=${property}${flags(settings)}&b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => window.__ceeReady === true || window.__ceeError, null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.__ceeError)).toBeFalsy();
};

test.describe('the field element under every combination of its presentation settings', () => {
  for (const settings of combinations(FIELD_SETTINGS)) {
    test(`a text field, ${describe(settings)}`, async ({ page }) => {
      await openField(page, '01-input-types', '_text', settings);
      const field = page.locator('cedar-embeddable-field');
      const input = field.locator('input:not([readonly]):not(:disabled)');
      if (!settings.readOnlyMode) {
        // Editable, it is the bare control whatever the presentation asks: the host draws the rest.
        await expect(input).toHaveCount(1);
        await expect(field.locator('app-cedar-component-header')).toHaveCount(0);
        await expect(field.locator('.cee-field-type')).toHaveCount(0);
        // The fixture's field carries its own requiredness, which the element keeps unless asked for quiet.
        await input.fill('value');
        await input.fill('');
        await input.blur();
        if (settings.suppressEmptyFieldErrors) await expect(field.locator('mat-error')).toHaveCount(0);
        else await expect(field.locator('mat-error')).toContainText('required');
        return;
      }
      // Read-only, it owns the presentation: a header unless the host titles it. A host that titles it
      // may ask for the type the hidden header's icon named; with the header shown, the icon names it.
      await expect(input).toHaveCount(0);
      await expect(field.locator('app-cedar-component-header')).toHaveCount(settings.previewMode ? 0 : 1);
      const typed = settings.previewMode && settings.showFieldType;
      await expect(field.locator('.cee-field-type')).toHaveCount(typed ? 1 : 0);
      if (typed) await expect(field.locator('.cee-field-type')).toHaveText('Text');
      await expect(field.locator('mat-error')).toHaveCount(0);
    });

    test(`a rich-text block, ${describe(settings)}`, async ({ page }) => {
      await openField(page, '19-template-markup', '_note', settings);
      const field = page.locator('cedar-embeddable-field');
      await expect(field.getByText('styled text')).toBeVisible();
      const html = await shadowHtml(page, 'cedar-embeddable-field');
      expect(html.includes('<iframe'), 'iframe in the rich text').toBe(settings.trustTemplateRichText);
      await expect(field.locator('app-cedar-component-header')).toHaveCount(
        settings.readOnlyMode && !settings.previewMode ? 1 : 0,
      );
    });
  }
});
