import { expect, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

export const BUNDLE_PATH = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../../public/cedar-embeddable-editor.js',
);

/** Stable across a run, and different as soon as the production bundle changes. */
export const BUNDLE_VERSION = String(fs.statSync(BUNDLE_PATH).mtimeMs);

/** CEE seeds temporal controls from the current time, so tests pin one instant. */
export const FROZEN = new Date('2026-01-01T09:30:00Z');

/** Load a fixture through the same host page and custom-element inputs an embedder uses. */
export const open = async (
  page: Page,
  fixture: string,
  preset?: string,
  instance?: string,
  mode?: 'separate' | 'combined' | 'template-first',
  extra?: string,
): Promise<void> => {
  await page.clock.setFixedTime(FROZEN);
  await page.goto(
    `/host.html?t=${fixture}${preset ? `&c=${preset}` : ''}${instance ? `&i=${instance}` : ''}` +
      `${mode ? `&m=${mode}` : ''}${extra ?? ''}&b=${BUNDLE_VERSION}`,
  );
  await page.waitForFunction(() => (window as any).__ceeReady === true || (window as any).__ceeError, null, {
    timeout: 20_000,
  });
  const err = await page.evaluate(() => (window as any).__ceeError);
  expect(err, `host page failed to load ${fixture}`).toBeFalsy();
  // Material ripples and expansion-panel transitions.
  await page.waitForTimeout(300);
};

export const openTwoEditors = async (page: Page, fixture: string): Promise<void> => {
  await page.clock.setFixedTime(FROZEN);
  await page.goto(`/host.html?host=multi&t=${fixture}&b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => (window as any).__ceeReady === true || (window as any).__ceeError, null, {
    timeout: 20_000,
  });
  expect(await page.evaluate(() => (window as any).__ceeError)).toBeFalsy();
  await expect(page.locator('#editor-first app-cedar-embeddable-metadata-editor')).toBeVisible();
  await expect(page.locator('#editor-second app-cedar-embeddable-metadata-editor')).toBeVisible();
};
