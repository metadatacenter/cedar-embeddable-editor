import { test, expect } from '@playwright/test';
import { open } from './support/host';
import type { CedarEmbeddableEditorElement } from '../../src/app/cee-public-api';

test('a saved paragraph fits when its initially hidden host is revealed without interaction', async ({ page }) => {
  const value = 'First saved line\nSecond saved line\nThird saved line\nFourth saved line';
  await page.route('**/host.html?**', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '</head>',
      '<style id="loading-host">#frame { display: none !important; }</style></head>',
    );
    await route.fulfill({ response, body });
  });
  await page.route('**/fixtures/01-input-types-instance.json', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json._textarea = { '@value': value };
    await route.fulfill({ response, json });
  });
  await open(page, '01-input-types', undefined, '01-input-types-instance');
  const paragraph = page.locator('cedar-embeddable-editor textarea').first();
  await expect(paragraph).toHaveValue(value);
  await expect(paragraph).toBeHidden();
  await page.evaluate(() => document.getElementById('loading-host')!.remove());
  await expect(paragraph).toBeVisible();
  await expect(paragraph).not.toBeFocused();
  await expect.poll(() => paragraph.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  await expect(paragraph).toHaveValue(value);
});

test('requested name wrapping exposes a complete field identity while editing at phone width', async ({ page }) => {
  await open(page, '01-input-types', undefined, undefined, undefined, '&f=wrapFieldNames');
  const label = 'Collection site and local environmental conditions for the collected specimen';
  await page.locator('cedar-embeddable-editor').evaluate(async (element, label) => {
    const editor = element as CedarEmbeddableEditorElement;
    const template = await (await fetch('./fixtures/01-input-types.json')).json();
    template._ui.propertyLabels._text = label;
    editor.style.display = 'block';
    editor.style.width = '375px';
    editor.templateObject = template;
  }, label);
  const header = page.locator('app-cedar-component-header').filter({ hasText: label }).first();
  const name = header.locator('.title-label');
  await expect(name).toHaveText(label);
  await expect(name).toHaveCSS('white-space', 'normal');
  const geometry = await name.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter((r) => r.width > 0);
    const box = el.closest('app-cedar-component-header')!.getBoundingClientRect();
    return { lines: lines.length, outside: lines.some((r) => r.left < box.left - 1 || r.right > box.right + 1) };
  });
  expect(geometry.lines).toBeGreaterThan(1);
  expect(geometry.outside).toBe(false);
  await expect(header.locator('.required-mark')).toBeVisible();
});
