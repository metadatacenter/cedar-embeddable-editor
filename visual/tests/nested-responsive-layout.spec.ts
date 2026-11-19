import { expect, test, type Page } from '@playwright/test';
import { open } from './support/host';
import { WIDTH_INDEPENDENT } from './width-tags';

const nestedName = 'Nested measurements';
const fieldName = 'Specimen collection and environmental observation notes from collaborating research institutions';

async function assertLayout(page: Page, width: number, count: number) {
  await expect
    .poll(() =>
      page.locator('mat-expansion-panel').evaluateAll((panels) => {
        const failures: string[] = [];
        for (const panel of panels) {
          const header = panel.querySelector(':scope > mat-expansion-panel-header')!;
          const body = panel.querySelector('.mat-expansion-panel-body');
          const pager = body?.querySelector(':scope > app-cedar-multi-pager');
          const controls = [...(pager?.querySelectorAll('mat-chip-option, button') ?? [])]
            .map((node) => node.getBoundingClientRect())
            .filter((box) => box.width > 0);
          for (const label of header.querySelectorAll('.title-label, .multi-instance-range')) {
            const range = document.createRange();
            range.selectNodeContents(label);
            for (const box of range.getClientRects()) {
              const bounds = header.getBoundingClientRect();
              if (box.left < bounds.left - 1 || box.right > bounds.right + 1) failures.push('clipped identity');
              if (
                controls.some(
                  (c) => c.left < box.right && c.right > box.left && c.top < box.bottom && c.bottom > box.top,
                )
              ) {
                failures.push('identity/control collision');
              }
            }
          }
        }
        return failures;
      }),
    )
    .toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (count > 0 && width === 375) {
    const nested = page
      .locator('mat-expansion-panel')
      .filter({
        has: page.locator(':scope > mat-expansion-panel-header').filter({ hasText: nestedName }),
      })
      .last();
    const name = nested.locator(':scope > mat-expansion-panel-header .title-label');
    await expect(name).toHaveText(nestedName);
    await expect(name).toHaveCSS('white-space', 'normal');
    const input = nested.locator('input[matinput]').first();
    expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(170);
  }
}

for (const count of [0, 1, 2, 5, 6, 12])
  for (const width of [1280, 768, 375]) {
    test(`nested element identities and controls remain usable with ${count} entries at ${width} ${WIDTH_INDEPENDENT}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/fixtures/03-nested-multi.json', async (route) => {
        const response = await route.fetch();
        const template = await response.json();
        template._ui.propertyLabels._author = 'Sample';
        const sample = template.properties._author;
        sample.minItems = count;
        sample.maxItems = Math.max(12, count);
        sample.items._ui.propertyLabels._affiliation = nestedName;
        const nested = sample.items.properties._affiliation;
        nested.minItems = count;
        nested.maxItems = Math.max(12, count);
        nested.items._ui.propertyLabels._name = fieldName;
        await route.fulfill({ response, json: template });
      });
      await open(page, '03-nested-multi', undefined, undefined, undefined, '&f=wrapFieldNames');
      await page.getByRole('button', { name: 'Expand All', exact: true }).click();
      await assertLayout(page, width, count);
      if (count === 12) {
        const pager = page.locator('app-cedar-multi-pager').first();
        await pager.getByRole('button', { name: 'Next page', exact: true }).click();
        await pager.getByRole('button', { name: 'Next page', exact: true }).click();
        await pager.getByRole('option', { name: '12', exact: true }).click();
        await expect(pager.getByRole('option', { name: '12', exact: true })).toHaveAttribute('aria-selected', 'true');
        await assertLayout(page, width, count);
        await page.screenshot({ path: info.outputPath(`nested-last-page-${width}.png`), fullPage: true });
        await page.setViewportSize({ width: width === 375 ? 768 : 375, height: 900 });
        await assertLayout(page, width === 375 ? 768 : 375, count);
        await page.setViewportSize({ width, height: 900 });
        await page.reload();
        await page.getByRole('button', { name: 'Expand All', exact: true }).click();
        await assertLayout(page, width, count);
      }
    });
  }
