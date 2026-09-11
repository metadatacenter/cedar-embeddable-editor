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

const open = async (page: Page, property: string, preset?: 'readonly', fixture = '01-input-types'): Promise<void> => {
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
  await page.evaluate(async () => {
    const template = await fetch('/fixtures/01-input-types.json').then((response) => response.json());
    const field = template.properties._numeric;
    field._valueConstraints.defaultValue = 7;
    document.querySelector('cedar-embeddable-field')!.fieldObject = field;
  });
  await expect.poll(() => currentValue(page)).toEqual({ kind: 'number', value: 7 });
  expect(await changes(page)).toEqual([]);
});
