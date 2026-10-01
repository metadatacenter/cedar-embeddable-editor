/**
 * The `cedar-embeddable-field` element, in a browser, from the bundle a host downloads.
 *
 * The unit and coordinator suites compile the component; this is the only place the
 * element is what a page actually gets — registered from the same script as the
 * editor, rendering into its own shadow root, styled by what that root carries. Two
 * of the faults this element could have are invisible anywhere else: never being
 * registered at all, and rendering unstyled because the stylesheet stayed in the
 * document head.
 *
 * The fields come out of the editor's own fixtures, so nothing here can pass against
 * an artifact written to make it pass.
 */
import { expect, test, type Page } from '@playwright/test';
import type { CedarEmbeddableFieldChangeDetail } from '../../src/app/cee-public-api';
import { BUNDLE_VERSION } from './support/host';

const open = async (
  page: Page,
  property: string,
  preset?: 'readonly' | 'preview',
  fixture = '01-input-types',
): Promise<void> => {
  await page.goto(
    `/host.html?host=field&t=${fixture}&p=${property}${preset ? `&c=${preset}` : ''}&b=${BUNDLE_VERSION}`,
  );
  await page.waitForFunction(() => window.__ceeReady === true || window.__ceeError, null, { timeout: 20_000 });
  expect(await page.evaluate(() => window.__ceeError), `host page failed to load ${property}`).toBeFalsy();
  await page.waitForTimeout(200);
};

const changes = (page: Page): Promise<CedarEmbeddableFieldChangeDetail[]> =>
  page.evaluate(() => window.__ceeFieldChanges ?? []);

const currentValue = (page: Page) =>
  page.evaluate(() => document.querySelector('cedar-embeddable-field')!.currentValue);

test.describe('the element a host loads', () => {
  test('is registered by the same bundle as the editor', async ({ page }) => {
    await page.goto(`/host.html?host=field&b=${BUNDLE_VERSION}`);

    await page.waitForFunction(() => customElements.get('cedar-embeddable-field') !== undefined);
    expect(await page.evaluate(() => customElements.get('cedar-embeddable-editor') !== undefined)).toBe(true);
  });

  /**
   * Styled, which is the thing a shadow root can quietly lose.
   *
   * The element carries its stylesheet into its own root; a stylesheet left in the
   * document head would leave every control rendering as an unstyled native input and
   * nothing would fail. Material's outlined form field is the visible consequence, so
   * its own element is what gets asserted.
   */
  test('carries its styles into its shadow root', async ({ page }) => {
    await open(page, '_text');

    const outline = page.locator('cedar-embeddable-field .mat-mdc-form-field');
    await expect(outline).toBeVisible();
    expect(
      await outline.evaluate((node) => getComputedStyle(node).display),
      'the Material form field rendered without its stylesheet',
    ).not.toBe('inline');
  });
});

test.describe('acquiring a value', () => {
  test('reports what was typed as a literal', async ({ page }) => {
    await open(page, '_text');

    await page.locator('cedar-embeddable-field input').fill('a typed answer');

    await expect(async () => expect((await changes(page)).length).toBeGreaterThan(0)).toPass();
    expect((await changes(page)).at(-1)).toEqual({
      value: { kind: 'literal', value: 'a typed answer' },
      valid: true,
    });
    expect(await currentValue(page)).toEqual({ kind: 'literal', value: 'a typed answer' });
  });

  test('reports a number as a number', async ({ page }) => {
    await open(page, '_numeric');

    await page.locator('cedar-embeddable-field input').fill('42');

    await expect(async () => expect((await changes(page)).length).toBeGreaterThan(0)).toPass();
    expect((await changes(page)).at(-1)?.value).toEqual({ kind: 'number', value: 42 });
  });

  test('takes a value the host assigns, and does not announce it back', async ({ page }) => {
    await open(page, '_text');

    await page.evaluate(() => {
      document.querySelector('cedar-embeddable-field')!.value = { kind: 'literal', value: 'assigned' };
    });

    await expect(page.locator('cedar-embeddable-field input')).toHaveValue('assigned');
    expect(await changes(page)).toEqual([]);
  });
});

test.describe('presenting a value', () => {
  /** Read-only with nothing in it states what the field will accept. */
  test('states the specification when the field is empty', async ({ page }) => {
    await open(page, '_numeric', 'readonly');

    await expect(page.locator('cedar-embeddable-field .cee-spec-box')).toBeVisible();
  });

  test('shows a value the host assigned instead of the specification', async ({ page }) => {
    await open(page, '_text', 'readonly');

    await page.evaluate(() => {
      document.querySelector('cedar-embeddable-field')!.value = { kind: 'literal', value: 'recorded' };
    });

    await expect(page.locator('cedar-embeddable-field input')).toHaveValue('recorded');
    await expect(page.locator('cedar-embeddable-field .cee-spec-box')).toHaveCount(0);
  });
});

test('a rejected assignment stays rejected after changing the field type', async ({ page }) => {
  await open(page, '_text', 'readonly');
  await page.evaluate(() => {
    document.querySelector('cedar-embeddable-field')!.value = { kind: 'number', value: 99 };
  });
  await expect(page.locator('cedar-embeddable-field .cee-spec-box')).toBeVisible();
  await expect(page.locator('cedar-embeddable-field .cee-spec-box')).toBeEmpty();
  await page.evaluate(async () => {
    const template = await fetch('/fixtures/01-input-types.json').then((response) => response.json());
    const field = template.properties._numeric;
    field._valueConstraints.defaultValue = 7;
    document.querySelector('cedar-embeddable-field')!.fieldObject = field;
  });
  await expect.poll(() => currentValue(page)).toEqual({ kind: 'number', value: 7 });
  expect(await changes(page)).toEqual([]);
});

// Every field route, using the same artifacts that exercise full CEE forms.
const fieldPreviews = [
  ['01-input-types', '_text'],
  ['01-input-types', '_textarea'],
  ['01-input-types', '_numeric'],
  ['01-input-types', '_email'],
  ['01-input-types', '_phone'],
  ['01-input-types', '_link'],
  ['01-input-types', '_date'],
  ['02-choices', '_radio'],
  ['02-choices', '_checkbox'],
  ['02-choices', '_single_list'],
  ['02-choices', '_multi_list'],
  ['04-controlled-terms', '_organism'],
  ['08-authority', '_contributor_orcid'],
  ['08-authority', '_institution_ror'],
  ['08-authority', '_chemical_pfas'],
  ['08-authority', '_citation_pmid'],
  ['08-authority', '_resource_rrid'],
  ['08-authority', '_award_nih'],
  ['08-authority', '_dataset_doi'],
  ['10-attribute-values', '_attribute'],
  ['05-static-paged', '_section'],
  ['05-static-paged', '_note'],
  ['05-static-paged', '_pb'],
  ['05-static-paged', '_diagram'],
  ['16-youtube', '_video'],
];

for (const [fixture, property] of fieldPreviews) {
  test(`read-only ${property} owns its complete presentation`, async ({ page }) => {
    await open(page, property, 'readonly', fixture);
    await page.evaluate(
      async ({ fixture, property }) => {
        const template = await fetch(`/fixtures/${fixture}.json`).then((response) => response.json());
        const slot = template.properties[property];
        const field = slot.items || slot;
        field['schema:description'] = 'A description supplied by the field artifact.';
        document.querySelector('cedar-embeddable-field')!.fieldObject = field;
      },
      { fixture, property },
    );
    const field = page.locator('cedar-embeddable-field');
    await expect(field.locator('.title-label')).not.toBeEmpty();
    // A field's type icon names its type. A page break draws nothing else, so it states its type.
    if (property === '_pb') await expect(field.locator('.cee-field-type')).toHaveText('Page break');
    else await expect(field.locator('.cee-field-type')).toHaveCount(0);
    await expect(
      field.locator('input[placeholder]:not([placeholder=""]), textarea[placeholder]:not([placeholder=""])'),
    ).toHaveCount(0);
    if (['_text', '_textarea', '_email', '_phone', '_link'].includes(property)) {
      await expect(field.locator('.cee-spec-box')).toBeEmpty();
    }
    const description = field
      .locator('.cee-field-spec-description, mat-card-content')
      .filter({ hasText: 'A description supplied by the field artifact.' });
    await expect(description).toHaveCount(1);
    await expect(description).toBeVisible();
    await expect(
      field.locator(
        'input:visible:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([readonly]):not(:disabled), textarea:visible:not([readonly]):not(:disabled), select:visible:not(:disabled), [contenteditable=true]:visible',
      ),
    ).toHaveCount(0);
    for (const choice of await field.locator('mat-radio-button, mat-checkbox').all()) {
      await expect(choice).toHaveAttribute('aria-disabled', 'true');
      await expect(choice.locator('input')).toHaveAttribute('tabindex', '-1');
      await expect(choice).toHaveCSS('pointer-events', 'none');
    }
    expect(await field.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await changes(page)).toEqual([]);
    if (['_award_nih', '_numeric', '_attribute'].includes(property)) {
      await expect(field).toHaveScreenshot(`cef-${property}.png`);
    }
  });
}

/**
 * A host that supplies a field's heading, as the Workspace's preview does, hides the field's header
 * and with it the icon that names the field's type. The field states its type instead, with the icon
 * its header would have drawn, so the host never has to know which icon a type takes.
 */
const hostTitledPreviews: Array<[fixture: string, property: string, type: string, icon: string]> = [
  ['01-input-types', '_text', 'Text', 'field-text'],
  ['04-controlled-terms', '_organism', 'Controlled term', 'field-controlled'],
  ['08-authority', '_award_nih', 'NIH Grant ID', 'authority-grant'],
  ['10-attribute-values', '_attribute', 'Attribute–value pairs', 'field-attribute-value'],
];

for (const [fixture, property, type, icon] of hostTitledPreviews) {
  test(`a host-titled preview of ${property} states its type with its icon`, async ({ page }) => {
    await open(page, property, 'preview', fixture);
    await page.evaluate(
      async ({ fixture, property }) => {
        const template = await fetch(`/fixtures/${fixture}.json`).then((response) => response.json());
        const slot = template.properties[property];
        const field = slot.items || slot;
        field['schema:description'] = 'A description supplied by the field artifact.';
        document.querySelector('cedar-embeddable-field')!.fieldObject = field;
      },
      { fixture, property },
    );
    const field = page.locator('cedar-embeddable-field');
    await expect(field.locator('app-cedar-component-header')).toHaveCount(0);
    const statement = field.locator('.cee-field-type');
    await expect(statement).toHaveText(type);
    await expect(statement.locator('[data-field-type-icon]')).toBeVisible();
    await expect(statement.locator('[data-field-type-icon]')).toHaveAttribute('data-mat-icon-name', icon);
    expect(await changes(page)).toEqual([]);
    if (['_award_nih', '_attribute'].includes(property)) {
      await expect(field).toHaveScreenshot(`cef-preview-${property}.png`);
    }
  });
}
