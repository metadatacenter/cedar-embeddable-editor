import { test, expect } from '@playwright/test';
import { addAttributeRow, open } from './support/host';
import type { CedarEmbeddableEditorElement } from '../../src/app/cee-public-api';

test('a wrapped build identifier keeps the CEE name beside its logo in a narrow Preview', async ({ page }) => {
  await open(page, '01-input-types', undefined, undefined, undefined, '&f=wrapFieldNames,readOnlyMode');
  await page.locator('cedar-embeddable-editor').evaluate((element) => {
    element.style.display = 'block';
    element.style.width = '326px';
  });
  const stamp = page.locator('.cee-version');
  await expect(stamp).toHaveCSS('white-space', 'normal');
  await expect
    .poll(async () => {
      const mark = (await page.locator('.header-image').boundingBox())!;
      const name = (await page.locator('.cee-name').boundingBox())!;
      return name.y + name.height - (mark.y + mark.height);
    })
    .toBeLessThanOrEqual(0);
  const content = await stamp.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const bounds = element.getBoundingClientRect();
    return [...range.getClientRects()].every(
      (line) => line.left >= bounds.left - 1 && line.right <= bounds.right + 1 && line.bottom <= bounds.bottom + 1,
    );
  });
  expect(content).toBe(true);
});

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

for (const readOnly of [false, true]) {
  test(`Tab reveals Attribute Value labels inside a scrolling host, read-only ${readOnly}`, async ({ page }) => {
    await open(
      page,
      '10-attribute-values',
      undefined,
      undefined,
      undefined,
      readOnly ? '&f=wrapFieldNames,readOnlyMode' : '&f=wrapFieldNames',
    );
    if (!readOnly) await addAttributeRow(page);
    const editor = page.locator('cedar-embeddable-editor');
    await editor.evaluate((element) => {
      const scroll = document.createElement('div');
      scroll.id = 'attribute-scroll-host';
      scroll.style.cssText = 'height:300px;width:100%;overflow:auto;';
      const before = document.createElement('div');
      before.style.height = '400px';
      const after = before.cloneNode() as HTMLElement;
      element.before(scroll);
      scroll.append(before, element, after);
    });
    const box = page.locator('#attribute-scroll-host');
    const pair = page.locator('app-cedar-input-attribute-value').first();
    const inputs = pair.locator('input');
    await inputs.first().focus();
    await page.keyboard.press('Shift+Tab');
    // Simulate reading farther down while focus remains on the preceding stop.
    // The next real Tab must reveal the entire labelled control, not just its lower half.
    const top = (await inputs.first().boundingBox())!.y;
    await box.evaluate((element, top) => {
      element.scrollTop += top - element.getBoundingClientRect().top + 10;
    }, top);
    for (const input of await inputs.all()) {
      await page.keyboard.press('Tab');
      await expect(input).toBeFocused();
      const bounds = (await box.boundingBox())!;
      const field = input.locator('..').locator('xpath=ancestor::mat-form-field');
      const label = (await field.locator('mat-label').boundingBox())!;
      const control = (await input.boundingBox())!;
      expect(label.y).toBeGreaterThanOrEqual(bounds.y);
      expect(control.y).toBeGreaterThanOrEqual(bounds.y);
      expect(control.y + control.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      if (readOnly) {
        const value = await input.inputValue();
        await page.keyboard.type('attempted-edit');
        await expect(input).toHaveValue(value);
      }
    }
    // Moving between boxes in the middle of the viewport must not introduce a scroll jump.
    await pair.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    // Let the browser apply scroll anchoring from the synthetic centering before measuring.
    await box.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    const settled = await box.evaluate((element) => element.scrollTop);
    await page.keyboard.press('Shift+Tab');
    await expect(inputs.first()).toBeFocused();
    expect(await box.evaluate((element) => element.scrollTop)).toBe(settled);
  });
}
