import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const BUNDLE_PATH = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../public/cedar-embeddable-editor.js',
);
const BUNDLE_VERSION = String(fs.statSync(BUNDLE_PATH).mtimeMs);

test('loading the production bundle twice reuses the first bootstrap', async ({ page }) => {
  await page.goto(`/host.html?b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => customElements.get('cedar-embeddable-editor'));
  await page.evaluate(() => {
    const host = window as any;
    host.__ceeFirstBootstrap = host.cedarEmbeddableEditorBootstrap;
    host.__ceeFirstConstructor = customElements.get('cedar-embeddable-editor');
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
    const host = window as any;
    return {
      sameBootstrap: host.cedarEmbeddableEditorBootstrap === host.__ceeFirstBootstrap,
      sameConstructor: customElements.get('cedar-embeddable-editor') === host.__ceeFirstConstructor,
    };
  });

  expect(state.sameBootstrap).toBe(true);
  expect(state.sameConstructor).toBe(true);
  expect(errors).toEqual([]);
});
