import { test, expect } from '@playwright/test';
import { BUNDLE_VERSION, open } from './support/host';

test('compact CEF matches read-only height and stays compact after typing and clearing', async ({ page }) => {
  await page.goto(`/host.html?host=field&t=01-input-types&p=_text&b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => window.__ceeReady);
  const field = page.locator('cedar-embeddable-field');

  const box = field.locator('.mat-mdc-text-field-wrapper').first();
  await expect(box).toBeVisible();
  await expect.poll(async () => (await box.boundingBox())!.height).toBe(36);
  await field.locator('input').fill('A compact value');
  await expect.poll(async () => (await box.boundingBox())!.height).toBe(36);
  await expect(field.locator('input')).toHaveCSS('font-size', '14px');
  await field.getByRole('button', { name: /Clear/i }).click();
  await expect.poll(async () => (await box.boundingBox())!.height).toBe(36);
  const referencePage = await page.context().newPage();
  await open(referencePage, '01-input-types', 'readonly');
  await referencePage.locator('cedar-embeddable-editor').evaluate((el) => el.setAttribute('density', 'comfortable'));
  const reference = referencePage.locator('.cee-spec-box').first();
  await expect(reference).toBeVisible();
  expect((await reference.boundingBox())!.height).toBe((await box.boundingBox())!.height);
  await referencePage.close();
  // Public tokens cross the shadow boundary, and changing density preserves values.
  await field.locator('input').fill('Retained');
  await field.evaluate((el) => el.style.setProperty('--cedar-control-height', '40px'));
  await expect.poll(async () => (await box.boundingBox())!.height).toBe(40);
  await expect(field.locator('input')).toHaveValue('Retained');
});

test('editable compact CEE uses the same box height and keeps temporal placeholders whole', async ({ page }) => {
  await open(page, '09-temporal');
  const editor = page.locator('cedar-embeddable-editor');

  const clocks = editor.locator('.cee-time-input-shell');
  await expect(clocks.first()).toBeVisible();
  for (const clock of await clocks.all()) {
    expect((await clock.boundingBox())!.height).toBe(36);
    for (const segment of await clock.locator('input').all()) {
      const fit = await segment.evaluate((el: HTMLInputElement) => {
        const style = getComputedStyle(el);
        const canvas = document.createElement('canvas').getContext('2d')!;
        canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return {
          available: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          needed: canvas.measureText(el.placeholder).width,
        };
      });
      expect(fit.needed).toBeLessThanOrEqual(fit.available);
    }
  }
  for (const box of await editor.locator('.mat-mdc-text-field-wrapper').all()) {
    if (await box.isVisible()) expect((await box.boundingBox())!.height).toBe(36);
  }
});

test('compact paragraphs start with two rows and grow without clipping content', async ({ page }) => {
  await page.goto(`/host.html?host=field&t=01-input-types&p=_textarea&b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => window.__ceeReady);
  const field = page.locator('cedar-embeddable-field');

  const input = field.locator('textarea');
  await expect(input).toBeVisible();
  await expect.poll(async () => (await input.boundingBox())!.height).toBeLessThanOrEqual(50);
  await input.fill('One\nTwo\nThree\nFour\nFive');
  await expect.poll(async () => (await input.boundingBox())!.height).toBeGreaterThan(90);
  await expect(input).toHaveValue('One\nTwo\nThree\nFour\nFive');
});

test('Material choice controls use the shared CEDAR primary palette', async ({ page }) => {
  await open(page, '02-choices');
  const editor = page.locator('cedar-embeddable-editor');
  const checkbox = editor.locator('mat-checkbox').first();
  await expect(checkbox).toBeVisible();
  await checkbox.locator('input').check();
  await expect(checkbox.locator('.mdc-checkbox__background')).toHaveCSS('background-color', 'rgb(15, 118, 134)');
  const radio = editor.locator('mat-radio-button').first();
  await radio.locator('input').check();
  await expect(radio.locator('.mdc-radio__inner-circle')).toHaveCSS('background-color', 'rgb(15, 118, 134)');
});

/**
 * Read only, a text, email or phone value is drawn in a box that grows, so that a long value wraps.
 * A short value takes one row, and its box is the one-line box a numeric value keeps, in every
 * density and after the density changes.
 */
test('a short read-only text, email or phone value keeps the one-line box of each density', async ({ page }) => {
  await page.route('**/fixtures/01-input-types-instance.json', async (route) => {
    const json = await (await route.fetch()).json();
    Object.assign(json, {
      _text: { '@value': 'A short value' },
      _email: { '@value': 'curator@example.org' },
      _phone: { '@value': '+1 650 555 0100' },
      _numeric: { '@value': '42', '@type': 'xsd:decimal' },
    });
    await route.fulfill({ json });
  });
  await open(page, '01-input-types', 'readonly', '01-input-types-instance');
  const editor = page.locator('cedar-embeddable-editor');
  const boxOf = (widget: string) => editor.locator(`${widget} .mat-mdc-text-field-wrapper`);
  const heightOf = async (widget: string) => (await boxOf(widget).boundingBox())!.height;
  const lineValues = ['app-cedar-input-text', 'app-cedar-input-email', 'app-cedar-input-phone'];

  await expect(boxOf('app-cedar-input-numeric').locator('input')).toHaveValue('42');
  for (const widget of lineValues) await expect(boxOf(widget).first().locator('textarea')).toHaveCount(1);
  for (const [density, height] of [
    [null, 36],
    ['authoring', 32],
    ['comfortable', 36],
    ['compact', 36],
  ] as const) {
    if (density) await editor.evaluate((el, profile) => el.setAttribute('density', profile), density);
    await expect.poll(() => heightOf('app-cedar-input-numeric'), density ?? 'default').toBe(height);
    for (const widget of lineValues)
      await expect
        .poll(
          () =>
            boxOf(widget)
              .first()
              .boundingBox()
              .then((box) => box!.height),
          widget,
        )
        .toBe(height);
  }
});
