import { expect, test, type Locator, type Page } from '@playwright/test';
import { addAttributeRow, hermetic, open } from './support/host';

/**
 * WCAG 3.1.2, Language of Parts: CEE's own text is marked with the language it is shown in, a value
 * an instance tags with `@language` is marked with that tag where CEE shows it as text, a control
 * holding a value of a field that declares a language for its values is marked with it, and the text
 * a template writes is marked with the language the template declares for it.
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
    // Descriptions are registered as tooltips are, on load. An occurrence pager's actions carry
    // tooltips; a field's marks carry none of their own.
    await open(page, '03-nested-multi', preset);
    await expect(inEditor(page, '.cdk-describedby-message-container')).toHaveAttribute('lang', language);
    await open(page, '02-choices', preset);
    await expect(editorRoot(page)).toHaveAttribute('lang', language);
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

/**
 * Serve a fixture whose fields declare these languages for their values, as a field's `@context`
 * states it with `@language`.
 */
const declareLanguages = async (page: Page, fixture: string, languages: Record<string, string>): Promise<void> => {
  await page.route(`**/fixtures/${fixture}.json`, async (route) => {
    const template = await (await route.fetch()).json();
    for (const [property, language] of Object.entries(languages)) {
      const field = template.properties[property];
      (field.items ?? field)['@context']['@language'] = language;
    }
    await route.fulfill({ json: template });
  });
};

test('an editable box of a field that declares a language for its values is marked with it', async ({ page }) => {
  await declareLanguages(page, '01-input-types', {
    _text: 'fr',
    _textarea: 'de-CH',
    _email: 'not a tag',
    _numeric: 'fr',
  });
  await open(page, '01-input-types', 'hu');
  const editor = page.locator('cedar-embeddable-editor');
  await expect(editorRoot(page)).toHaveAttribute('lang', 'hu');
  const text = editor.getByRole('textbox', { name: 'text', exact: true });
  await expect(text).toHaveAttribute('lang', 'fr');
  await expect(text).toHaveJSProperty('spellcheck', false);
  await expect(editor.getByRole('textbox', { name: 'textarea', exact: true })).toHaveAttribute('lang', 'de-CH');
  // A malformed tag is not asserted, and a number is no text in any language.
  await expect(editor.getByRole('textbox', { name: 'email', exact: true })).not.toHaveAttribute('lang', /.*/);
  await expect(editor.locator('app-cedar-input-numeric input')).not.toHaveAttribute('lang', /.*/);
  // A field that declares nothing leaves its box in the form's language.
  await expect(editor.getByRole('textbox', { name: 'phone', exact: true })).not.toHaveAttribute('lang', /.*/);
});

test('read only, a tagged value keeps its tag and an untagged one takes the declared language', async ({ page }) => {
  await declareLanguages(page, '01-input-types', { _text: 'fr', _textarea: 'de-CH' });
  await open(page, '01-input-types', 'readonly');
  await assignTaggedInstance(page);
  const editor = page.locator('cedar-embeddable-editor');
  await expect(editor.getByRole('textbox', { name: 'text', exact: true })).toHaveAttribute('lang', 'de');
  await expect(editor.getByRole('textbox', { name: 'textarea', exact: true })).toHaveAttribute('lang', 'de-CH');
});

test("a choice field's options and selection are marked with the language it declares", async ({ page }) => {
  await declareLanguages(page, '02-choices', { _radio: 'fr', _checkbox: 'fr', _single_list: 'fr' });
  await open(page, '02-choices');
  const editor = page.locator('cedar-embeddable-editor');
  for (const option of await editor.locator('mat-radio-button').all())
    await expect(option).toHaveAttribute('lang', 'fr');
  for (const option of await editor.locator('app-cedar-input-checkbox mat-checkbox').all())
    await expect(option).toHaveAttribute('lang', 'fr');
  const select = editor.getByRole('combobox', { name: 'single_list', exact: true });
  await expect(select.locator('mat-select-trigger')).toHaveAttribute('lang', 'fr');
  // The control keeps the form's language, so its name is read in it.
  await expect(select).not.toHaveAttribute('lang', /.*/);
  await select.click();
  // The panel is named by the label, and the template declares no language for its text.
  await expect(page.getByRole('listbox', { name: 'single_list' })).not.toHaveAttribute('lang', /.*/);
  const options = page.getByRole('listbox', { name: 'single_list' }).getByRole('option');
  expect(await options.count()).toBeGreaterThan(0);
  for (const option of await options.all()) await expect(option).toHaveAttribute('lang', 'fr');
  // A field that declares nothing leaves its options in the form's language.
  await page.keyboard.press('Escape');
  await editor.getByRole('combobox', { name: 'multi_list', exact: true }).click();
  const undeclared = page.getByRole('listbox', { name: 'multi_list' }).getByRole('option');
  expect(await undeclared.count()).toBeGreaterThan(0);
  for (const option of await undeclared.all()) await expect(option).not.toHaveAttribute('lang', /.*/);
});

test("an attribute's value box is marked with the language its field declares, and its name box is not", async ({
  page,
}) => {
  await declareLanguages(page, '10-attribute-values', { _attribute: 'fr' });
  await open(page, '10-attribute-values');
  await addAttributeRow(page);
  const editor = page.locator('cedar-embeddable-editor');
  await expect(editor.getByRole('textbox', { name: 'Attribute Value', exact: true })).toHaveAttribute('lang', 'fr');
  await expect(editor.getByRole('textbox', { name: 'Attribute Name', exact: true })).not.toHaveAttribute('lang', /.*/);
});

test('the field element marks its editable box with the language its field declares', async ({ page }) => {
  await declareLanguages(page, '01-input-types', { _text: 'fr' });
  await open(page, '01-input-types', undefined, undefined, undefined, '&host=field&p=_text');
  await expect(fieldRoot(page).getByRole('textbox', { name: 'text', exact: true })).toHaveAttribute('lang', 'fr');
});

/**
 * A template's own language. A template or element states the language of its text with `@language`
 * in its own `@context`, and the elements showing that text are marked with it: the template's title
 * and description, each label and description, the section break, rich text, image and video, and a
 * choice field's name and options. CEE's text inside one of them states CEE's language again. A
 * control that holds what is typed into it is not marked, and neither is CEE's own text around it.
 *
 * `28-template-language` is French, with one element that states nothing and one that states English.
 * Its `ville` field declares German values and its `taille` list Italian ones.
 */
const TEMPLATE_LANGUAGE = '28-template-language';

/** The header label of the component with this name, at the top of its own renderer. */
const labelOf = (page: Page, name: string): Locator =>
  inEditor(page, '.title-label').filter({ hasText: new RegExp(`^\\s*${name}\\s*\\*?\\s*$`) });

for (const [preset, ui] of [
  [undefined, 'en'],
  ['hu', 'hu'],
] as const) {
  test(`a French template's text is marked as French in an ${ui} form, and CEE's text as ${ui}`, async ({ page }) => {
    await hermetic(page);
    await open(page, TEMPLATE_LANGUAGE, preset, undefined, undefined, '&f=showTemplateDescription');
    const editor = page.locator('cedar-embeddable-editor');
    await expect(editorRoot(page)).toHaveAttribute('lang', ui);

    await expect(inEditor(page, '.template-label')).toHaveAttribute('lang', 'fr');
    await expect(inEditor(page, '.template-description')).toHaveAttribute('lang', 'fr');

    // A label and its description are the template's. The required mark's name is CEE's.
    const nom = labelOf(page, 'nom');
    await expect(nom).toHaveAttribute('lang', 'fr');
    await expect(nom.locator('sup.required-mark')).toHaveAttribute('lang', ui);
    await expect(inEditor(page, '.cee-description:text-is("nom property description")')).toHaveAttribute('lang', 'fr');
    // The box holds what is typed, which the template did not write. A field that declares a language
    // for its values marks its box with that one, and its label keeps the template's.
    await expect(editor.getByRole('textbox', { name: 'nom', exact: true })).not.toHaveAttribute('lang', /.*/);
    await expect(editor.getByRole('textbox', { name: 'ville', exact: true })).toHaveAttribute('lang', 'de');
    await expect(labelOf(page, 'ville')).toHaveAttribute('lang', 'fr');

    // A choice field's name and options are the template's, and its clear button is CEE's.
    const couleur = editor.getByRole('radiogroup', { name: 'couleur', exact: true });
    await expect(couleur).toHaveAttribute('lang', 'fr');
    for (const option of await couleur.locator('mat-radio-button').all())
      await expect(option).toHaveAttribute('lang', 'fr');
    await couleur.getByRole('radio', { name: 'Rouge', exact: true }).check();
    await expect(couleur.locator('button.choice-clear-button')).toHaveAttribute('lang', ui);
    const fruits = editor.getByRole('group', { name: 'fruits', exact: true });
    await expect(fruits).toHaveAttribute('lang', 'fr');
    for (const option of await fruits.locator('mat-checkbox').all()) await expect(option).toHaveAttribute('lang', 'fr');

    // A list's options take the language it declares for its values, and otherwise the template's. Its
    // panel is named by its label, and so takes the template's language.
    for (const [name, values] of [
      ['taille', 'it'],
      ['forme', 'fr'],
    ] as const) {
      const select = editor.getByRole('combobox', { name, exact: true });
      await expect(select).toHaveAttribute('lang', 'fr');
      await select.click();
      await expect(page.getByRole('listbox', { name })).toHaveAttribute('lang', 'fr');
      const options = page.getByRole('listbox', { name }).getByRole('option');
      expect(await options.count()).toBeGreaterThan(0);
      for (const option of await options.all()) await expect(option).toHaveAttribute('lang', values);
      await options.first().click();
      await expect(select.locator('mat-select-trigger')).toHaveAttribute('lang', values);
    }

    // Static content is the template's. The help mark's name is CEE's.
    const heading = editor.getByRole('heading', { name: 'Partie un', exact: true });
    await expect(heading).toHaveAttribute('lang', 'fr');
    await expect(heading.locator('mat-icon')).toHaveAttribute('lang', ui);
    await expect(inEditor(page, 'app-cedar-static-section-break .cdk-visually-hidden')).toHaveAttribute('lang', 'fr');
    await expect(inEditor(page, 'app-cedar-static-rich-text > div')).toHaveAttribute('lang', 'fr');
    await expect(inEditor(page, 'app-cedar-static-image [role="img"]')).toHaveAttribute('lang', 'fr');
    await expect(inEditor(page, 'app-cedar-static-youtube iframe')).toHaveAttribute('lang', 'fr');

    // An element that states nothing holds the template's text. One that states English holds English.
    for (const [element, child, language] of [
      ['adresse', 'rue', 'fr'],
      ['address', 'street', 'en'],
    ] as const) {
      await expect(labelOf(page, element)).toHaveAttribute('lang', language);
      await expect(labelOf(page, child)).toHaveAttribute('lang', language);
    }

    // CEE's own buttons and messages are in CEE's language, whether inside one of the marked
    // elements or not. Emptying a required box and a required group shows a message for each.
    const box = editor.getByRole('textbox', { name: 'nom', exact: true });
    await box.fill('x');
    await box.fill('');
    const pomme = fruits.getByRole('checkbox', { name: 'Pomme', exact: true });
    await pomme.check();
    await pomme.uncheck();
    await expect(inEditor(page, 'mat-error')).toHaveCount(2);
    await expect(fruits.locator('mat-error')).toHaveAttribute('lang', ui);
    const languages = await inEditor(page, 'button, mat-error').evaluateAll((elements) =>
      elements.map((element) => element.closest('[lang]')?.getAttribute('lang')),
    );
    expect(languages.length).toBeGreaterThan(3);
    expect(new Set(languages)).toEqual(new Set([ui]));
  });
}

test("a French template's read-only descriptions and option lists are marked as French", async ({ page }) => {
  await hermetic(page);
  await open(page, TEMPLATE_LANGUAGE, 'hu', undefined, undefined, '&f=readOnlyMode');
  const description = inEditor(page, '.cee-field-spec-description:text-is("nom property description")');
  await expect(description).toHaveAttribute('lang', 'fr');
  // A list read with nothing filled in states its options, in the language of its values.
  for (const [name, values] of [
    ['taille', 'it'],
    ['forme', 'fr'],
  ] as const) {
    const options = inEditor(
      page,
      `app-cedar-component-renderer:has(.title-label:text-is("${name}")) .cee-spec-box-options`,
    );
    await expect(options).toHaveAttribute('lang', values);
    await expect(options.locator('em')).toHaveAttribute('lang', 'hu');
  }
});

/** Serve a fixture whose template declares this language for its own text. */
const declareTemplateLanguage = async (page: Page, fixture: string, language: string): Promise<void> => {
  await page.route(`**/fixtures/${fixture}.json`, async (route) => {
    const template = await (await route.fetch()).json();
    template['@context']['@language'] = language;
    await route.fulfill({ json: template });
  });
};

/**
 * The text a control's `aria-labelledby` gives it, part by part, with the language each part is in.
 * The language of the form's root counts, so a part that states none reads as the form's.
 */
const languagesInName = (control: Locator): Promise<{ text: string; lang: string | null }[]> =>
  control.evaluate((element) => {
    const root = element.getRootNode() as ShadowRoot;
    const parts: { text: string; lang: string | null }[] = [];
    for (const id of (element.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)) {
      const walker = document.createTreeWalker(root.getElementById(id)!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = (node.textContent ?? '').trim();
        if (text) parts.push({ text, lang: node.parentElement!.closest('[lang]')?.getAttribute('lang') ?? null });
      }
    }
    return parts;
  });

/**
 * A temporal control's name joins its field's label to CEE's words, as `day_only, dátum kiválasztása`
 * does. The name is given as text, so that the label states the template's language and CEE's words
 * state CEE's. The time zone select joins the label to what it shows, which is CEE's too, and its
 * panel takes the select's name.
 */
for (const [declared, label] of [
  ['fr', 'fr'],
  [null, 'hu'],
] as const)
  test(`a name joining a label to CEE's words reads the label as ${label} and the words as hu`, async ({ page }) => {
    if (declared !== null)
      for (const fixture of ['09-temporal', '07-timezone', '21-temporal-normalization'])
        await declareTemplateLanguage(page, fixture, declared);
    const editor = page.locator('cedar-embeddable-editor');
    const expectParts = async (control: Locator, field: string): Promise<void> => {
      await expect(control).toBeVisible();
      const [first, ...rest] = await languagesInName(control);
      expect(first).toEqual({ text: field, lang: label });
      expect(rest.length).toBeGreaterThan(0);
      for (const part of rest) expect(part.lang).toBe('hu');
    };

    await open(page, '09-temporal', 'hu');
    await expect(editorRoot(page)).toHaveAttribute('lang', 'hu');
    for (const [role, name, field] of [
      ['textbox', 'year_only, év kiválasztása', 'year_only'],
      ['textbox', 'day_only, dátum kiválasztása', 'day_only'],
      ['group', 'to_the_second, idő', 'to_the_second'],
      ['textbox', 'decimal_seconds, törtmásodpercek megadása', 'decimal_seconds'],
    ] as const)
      await expectParts(editor.getByRole(role, { name, exact: true }), field);
    // A template that declares nothing marks nothing: its label takes the form's language.
    if (declared === null)
      await expect(inEditor(page, '.cdk-visually-hidden[aria-hidden="true"] span[lang]')).toHaveCount(0);

    await open(page, '21-temporal-normalization', 'hu');
    const yearAndMonth = editor.getByRole('textbox', { name: /, év és hónap kiválasztása$/ }).first();
    const [field] = await languagesInName(yearAndMonth);
    expect(field.lang).toBe(label);

    await open(page, '07-timezone', 'hu');
    const offset = editor.getByRole('combobox');
    await expectParts(offset, 'sampled_at');
    await offset.click();
    await expectParts(page.getByRole('listbox'), 'sampled_at');
  });

/**
 * An option the template makes its default carries CEE's mark, `(alapérték)` in Hungarian. The option
 * is the template's text and a value of the field, and the mark inside it is CEE's.
 */
test("a default option is marked as the template's text, and its default mark as CEE's", async ({ page }) => {
  await hermetic(page);
  await page.route(`**/fixtures/${TEMPLATE_LANGUAGE}.json`, async (route) => {
    const template = await (await route.fetch()).json();
    template.properties._couleur._valueConstraints.literals[0].selectedByDefault = true;
    template.properties._fruits.items._valueConstraints.literals[0].selectedByDefault = true;
    await route.fulfill({ json: template });
  });
  await open(page, TEMPLATE_LANGUAGE, 'hu', undefined, undefined, '&f=readOnlyMode');
  for (const [group, option, other] of [
    ['couleur', 'Rouge', 'Vert'],
    ['fruits', 'Pomme', 'Poire'],
  ] as const) {
    const options = inEditor(page, `app-cedar-component-renderer:has(.title-label:text-is("${group}"))`).locator(
      'mat-radio-button, mat-checkbox',
    );
    const chosen = options.filter({ hasText: option });
    await expect(chosen).toHaveAttribute('lang', 'fr');
    await expect(chosen.locator('.choice-default-mark')).toHaveText('(alapérték)');
    await expect(chosen.locator('.choice-default-mark')).toHaveAttribute('lang', 'hu');
    await expect(options.filter({ hasText: other })).toHaveAttribute('lang', 'fr');
  }
});

test("a default option takes the language its field declares, and its default mark keeps CEE's", async ({ page }) => {
  await declareLanguages(page, '11-choice-default', { _access: 'fr' });
  await open(page, '11-choice-default', 'hu', undefined, undefined, '&f=readOnlyMode');
  const limited = inEditor(page, 'mat-radio-button').filter({ hasText: 'Limited' });
  await expect(limited).toHaveAttribute('lang', 'fr');
  await expect(limited.locator('.choice-default-mark')).toHaveAttribute('lang', 'hu');
});

test('a default option of a field and template that declare nothing marks nothing', async ({ page }) => {
  await open(page, '11-choice-default', 'hu', undefined, undefined, '&f=readOnlyMode');
  const limited = inEditor(page, 'mat-radio-button').filter({ hasText: 'Limited' });
  await expect(limited.locator('.choice-default-mark')).toBeVisible();
  await expect(limited).not.toHaveAttribute('lang', /.*/);
  await expect(limited.locator('.choice-default-mark')).not.toHaveAttribute('lang', /.*/);
});

test('a template that declares no language leaves its text in the form language', async ({ page }) => {
  await open(page, '01-input-types', 'hu', undefined, undefined, '&f=showTemplateDescription');
  await expect(inEditor(page, '.template-label')).not.toHaveAttribute('lang', /.*/);
  await expect(inEditor(page, '.template-description')).not.toHaveAttribute('lang', /.*/);
  const labels = inEditor(page, '.title-label, sup.required-mark');
  expect(await labels.count()).toBeGreaterThan(1);
  for (const label of await labels.all()) await expect(label).not.toHaveAttribute('lang', /.*/);
});

test("the field element marks no label, because a field's own language is that of its values", async ({ page }) => {
  await declareLanguages(page, '01-input-types', { _text: 'fr' });
  await open(page, '01-input-types', 'readonly', undefined, undefined, '&host=field&p=_text');
  await expect(fieldRoot(page).locator('.title-label')).toBeVisible();
  await expect(fieldRoot(page).locator('.title-label')).not.toHaveAttribute('lang', /.*/);
});
