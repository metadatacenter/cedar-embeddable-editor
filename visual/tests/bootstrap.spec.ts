import { expect, test } from '@playwright/test';
import { BUNDLE_VERSION, open } from './support/host';

test('loading the production bundle twice reuses the first bootstrap', async ({ page }) => {
  await page.goto(`/host.html?b=${BUNDLE_VERSION}`);
  await expect
    .poll(() => page.evaluate(() => !!customElements.get('cedar-embeddable-editor')), { timeout: 30_000 })
    .toBeTruthy();
  await page.evaluate(() => {
    window.__ceeFirstBootstrap = window.cedarEmbeddableEditorBootstrap;
    window.__ceeFirstConstructor = customElements.get('cedar-embeddable-editor');
  });

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await page.addScriptTag({
    url: `/cedar-embeddable-editor.js?duplicate=${BUNDLE_VERSION}`,
  });
  await page.waitForTimeout(100);

  const state = await page.evaluate(() => {
    return {
      sameBootstrap: window.cedarEmbeddableEditorBootstrap === window.__ceeFirstBootstrap,
      sameConstructor: customElements.get('cedar-embeddable-editor') === window.__ceeFirstConstructor,
    };
  });

  expect(state.sameBootstrap).toBe(true);
  expect(state.sameConstructor).toBe(true);
  expect(errors).toEqual([]);
});

test('fixture readiness waits for a delayed artifact before exposing the public report', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const intercepted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/fixtures/01-input-types.json', async (route) => {
    requested();
    await held;
    await route.continue();
  });
  let opened = false;
  const opening = open(page, '01-input-types').then(() => {
    opened = true;
  });
  // Observe rejection promptly, while the response remains deliberately held.
  void opening.catch(() => {});
  try {
    await intercepted;
    await page.waitForLoadState('load');
    // A delayed server response must not be mistaken for a ready, quiet DOM.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(opened).toBe(false);
    release();
    await opening;
    expect(await page.evaluate(() => window.__ceeReady)).toBe(true);
    expect(await page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.dataQualityReport)).toEqual(
      expect.objectContaining({ problems: expect.any(Array) }),
    );
  } finally {
    release();
    await opening;
  }
});
