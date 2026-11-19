import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import { open } from './support/host';
import { WIDTH_INDEPENDENT } from './width-tags';

/** The primary colour as the design tokens publish it, which a page without the custom property falls back to. */
const PRIMARY = /--cedar-color-primary:\s*([^;]+);/
  .exec(
    fs.readFileSync(
      createRequire(import.meta.url).resolve('@org.metadatacenter/cedar-design-tokens/custom-properties.css'),
      'utf8',
    ),
  )![1]
  .trim();

/*
 * A link an author wrote in rich text takes CEDAR's link colour, the primary colour, rather than the
 * browser's blue or purple, and keeps the underline that tells it apart from the text around it.
 */
test(`an authored rich-text link takes the primary colour and keeps its underline ${WIDTH_INDEPENDENT}`, async ({
  page,
}) => {
  await open(page, '19-template-markup');
  const link = page.locator('cedar-embeddable-editor app-cedar-static-rich-text a[href="https://example.org/ok"]');
  await expect(link).toBeVisible();
  const style = await link.evaluate((element, fallback) => {
    // The primary colour as this shadow root resolves it: the custom property where the host sets
    // it, and the published token where it does not.
    const probe = document.createElement('span');
    probe.style.color = `var(--cedar-color-primary, ${fallback})`;
    element.parentElement!.append(probe);
    const primary = getComputedStyle(probe).color;
    probe.remove();
    const own = getComputedStyle(element);
    return { color: own.color, primary, decoration: own.textDecorationLine };
  }, PRIMARY);
  expect(style.color).toBe(style.primary);
  expect(style.color).not.toBe('rgb(0, 0, 238)');
  expect(style.decoration).toContain('underline');
});
