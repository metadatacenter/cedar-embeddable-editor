import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { open } from './support/host';
import { WIDTH_INDEPENDENT } from './width-tags';

/** The strong primary as the design tokens publish it, which a page without the custom property falls back to. */
const PRIMARY_STRONG = /--cedar-color-primary-strong:\s*([^;]+);/
  .exec(
    fs.readFileSync(
      createRequire(import.meta.url).resolve('@org.metadatacenter/cedar-design-tokens/custom-properties.css'),
      'utf8',
    ),
  )![1]
  .trim();

/** WCAG contrast between two `rgb(r, g, b)` colours. */
function contrast(a: string, b: string): number {
  const luminance = (rgb: string) => {
    const [r, g, bl] = (rgb.match(/\d+/g) ?? []).slice(0, 3).map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/*
 * A link an author wrote in rich text takes CEDAR's strong link colour rather than the browser's blue
 * or purple, and keeps the underline that tells it apart from the text around it. Authors set rich
 * text on light tints, so the colour must keep 4.5:1 on the lightest grey the corpus uses, #e8e8e8.
 */
test(`an authored rich-text link takes the strong primary colour and keeps its underline ${WIDTH_INDEPENDENT}`, async ({
  page,
}) => {
  await open(page, '19-template-markup');
  const link = page.locator('cedar-embeddable-editor app-cedar-static-rich-text a[href="https://example.org/ok"]');
  await expect(link).toBeVisible();
  const style = await link.evaluate((element, fallback) => {
    // The strong primary as this shadow root resolves it: the custom property where the host sets
    // it, and the published token where it does not.
    const probe = document.createElement('span');
    probe.style.color = `var(--cedar-color-primary-strong, ${fallback})`;
    element.parentElement!.append(probe);
    const strong = getComputedStyle(probe).color;
    probe.remove();
    const own = getComputedStyle(element);
    return { color: own.color, strong, decoration: own.textDecorationLine };
  }, PRIMARY_STRONG);
  expect(style.color).toBe(style.strong);
  expect(style.color).not.toBe('rgb(0, 0, 238)');
  expect(style.decoration).toContain('underline');
  expect(contrast(style.color, 'rgb(232, 232, 232)')).toBeGreaterThanOrEqual(4.5);
});
