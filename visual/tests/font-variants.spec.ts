import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { open } from './support/host';

const hostFonts = [400, 500]
  .map((weight) =>
    readFileSync(
      new URL(
        `../../node_modules/@org.metadatacenter/cedar-design-tokens/fonts/_roboto-${weight}.scss`,
        import.meta.url,
      ),
      'utf8',
    ),
  )
  .join('\n');

for (const hosted of [false, true]) {
  for (const field of [false, true]) {
    test(`${field ? 'CEF' : 'CEE'} ${hosted ? 'host fonts' : 'standalone'} renders readable text and shared SVG icons`, async ({
      page,
    }) => {
      if (hosted) {
        await page.route('**/host.html?*', async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body: (await response.text()).replace('</head>', `<style>${hostFonts}</style></head>`),
          });
        });
      }
      const requested: string[] = [];
      page.on('request', (request) => requested.push(request.url()));
      await open(
        page,
        '01-input-types',
        undefined,
        undefined,
        undefined,
        (hosted ? '&fonts=host' : '') + (field ? '&host=field&p=_text' : ''),
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const faces = await page.evaluate(() =>
        [...document.fonts].map((font) => ({
          family: font.family.replace(/['"]/g, ''),
          weight: font.weight,
          status: font.status,
        })),
      );
      expect(faces.some((face) => face.family.includes('Material Icons'))).toBe(false);
      const roboto = faces.filter((face) => face.family === 'CEE Roboto');
      expect(roboto.filter((face) => face.weight === '400').length).toBe(7);
      expect(roboto.filter((face) => face.weight === '500').length).toBe(7);
      expect(roboto.filter((face) => face.weight === '300').length).toBe(hosted ? 0 : 7);
      expect(
        requested.some((url) =>
          url.includes(hosted ? 'cedar-embeddable-editor.host-fonts.js?' : 'cedar-embeddable-editor.js?'),
        ),
      ).toBe(true);
      const input = page.locator('input[type="text"]').first();
      await input.fill('Font variant smoke');
      await expect(input).toHaveValue('Font variant smoke');
      await expect(page.locator('svg[data-cedar-icon]').first()).toBeVisible();
      const tiny = page.locator('.cee-name, .cee-version');
      await expect(tiny).toHaveCount(field ? 0 : 2);
      for (const label of await tiny.all()) {
        if (await label.isVisible())
          expect(await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
      }
    });
  }
}
