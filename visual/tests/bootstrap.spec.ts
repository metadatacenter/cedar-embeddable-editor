import { expect, test } from '@playwright/test';
import { BUNDLE_VERSION } from './support/host';

test('loading the production bundle twice reuses the first bootstrap', async ({ page }) => {
  await page.goto(`/host.html?b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => customElements.get('cedar-embeddable-editor'));
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
