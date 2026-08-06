/**
 * Small semantic checks for every browser engine CEE supports.
 *
 * The screenshot baselines stay on Chromium/macOS: duplicating them per engine
 * would mostly record font rasterisation. These tests instead exercise the
 * browser-sensitive seams of the shipped custom element — Shadow DOM, Angular
 * Material overlays, form events and host-facing properties — without pixels.
 */
import { expect, test, type Page } from '@playwright/test';
import { open } from './support/host';

const errorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
});

test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page) ?? [], 'browser console/page errors').toEqual([]);
});

test('registers the production custom element and renders inside Shadow DOM', async ({ page }) => {
  await open(page, '01-input-types');

  const state = await page.evaluate(() => {
    const editor = document.querySelector('cedar-embeddable-editor') as HTMLElement;
    return {
      defined: typeof customElements.get('cedar-embeddable-editor') === 'function',
      hasShadowRoot: editor.shadowRoot !== null,
      hasAngularEditor: editor.shadowRoot?.querySelector('app-cedar-embeddable-metadata-editor') !== null,
    };
  });
  expect(state).toEqual({ defined: true, hasShadowRoot: true, hasAngularEditor: true });
  await expect(page.locator('input[aria-label="text"]')).toBeVisible();
});

test('publishes edits through a composed change event and currentMetadata', async ({ page }) => {
  await open(page, '01-input-types');
  await page.evaluate(() => {
    (window as any).__ceeSmokeChanges = 0;
    document.querySelector('cedar-embeddable-editor')!.addEventListener('change', (event) => {
      if (event.composed) {
        (window as any).__ceeSmokeChanges += 1;
      }
    });
  });

  const field = page.locator('input[aria-label="text"]');
  await field.fill('cross-browser edit');
  await field.blur();

  await expect.poll(() => page.evaluate(() => (window as any).__ceeSmokeChanges)).toBeGreaterThan(0);
  const metadata = await page.evaluate(
    () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
  );
  expect(JSON.stringify(metadata)).toContain('cross-browser edit');
});

test('keeps a Material overlay inside the custom element', async ({ page }) => {
  await open(page, '02-choices');
  await page.locator('mat-select').first().click();
  await expect(page.locator('mat-option').first()).toBeVisible();

  const placement = await page.evaluate(() => {
    const editor = document.querySelector('cedar-embeddable-editor') as HTMLElement;
    return {
      inside: editor.shadowRoot?.querySelectorAll('.cee-overlay-container mat-option').length ?? 0,
      outside: document.body.querySelectorAll(':scope > .cdk-overlay-container').length,
    };
  });
  expect(placement.inside).toBeGreaterThan(0);
  expect(placement.outside).toBe(0);
});

test('updates temporal data through the custom time picker', async ({ page }) => {
  await open(page, '09-temporal');
  const seconds = page.locator('.cee-time-picker').nth(2).locator('input[aria-label="Second"]');
  await seconds.fill('42');
  await seconds.blur();

  await expect
    .poll(() =>
      page.evaluate(() => JSON.stringify((document.querySelector('cedar-embeddable-editor') as any).currentMetadata)),
    )
    .toContain(':42');
});

test('adds and removes a multi-instance value', async ({ page }) => {
  await open(page, '13-paged-choice', undefined, '13-paged-choice-instance');
  const pager = page.locator('app-cedar-multi-pager').first();
  const add = pager.locator('button').nth(0);
  const remove = pager.locator('button').nth(2);
  const count = () =>
    page.evaluate(() => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata._record.length);

  expect(await count()).toBe(2);
  await add.click();
  await expect.poll(count).toBe(3);
  await remove.click();
  await expect.poll(count).toBe(2);
});

test('honors read-only mode', async ({ page }) => {
  await open(page, '01-input-types', 'readonly');
  await expect(page.locator('input[aria-label="text"]')).toHaveAttribute('readonly', 'true');
  await expect(page.locator('input[aria-label="email"]')).toHaveAttribute('readonly', 'true');
});

test('replaces an instance and exposes JSON and YAML outputs', async ({ page }) => {
  await open(page, '11-choice-default', undefined, '11-choice-default-instance');
  await page.evaluate(() => {
    const editor = document.querySelector('cedar-embeddable-editor') as any;
    const replacement = structuredClone(editor.currentMetadata);
    replacement._access['@value'] = 'Public';
    editor.instanceObject = replacement;
  });

  await expect(page.getByRole('radio', { checked: true })).toHaveAccessibleName('Public');
  const outputs = await page.evaluate(() => {
    const editor = document.querySelector('cedar-embeddable-editor') as any;
    return { json: JSON.stringify(editor.currentMetadata), yaml: editor.currentMetadataYaml };
  });
  expect(outputs.json).toContain('Public');
  expect(outputs.yaml).toContain('Public');
});
