import { expect, test, type Page } from '@playwright/test';
import { open } from './support/host';
import { WIDTH_INDEPENDENT } from './width-tags';

/*
 * A ResizeObserver callback that changes the size of a box its observer watches makes the browser
 * defer that notification and report "ResizeObserver loop completed with undelivered notifications".
 * The pager placement and paragraph measurement once did exactly that. Playwright's pageerror event
 * misses the report in Chromium and undercounts it in WebKit, so these tests count the window's error
 * events, which every engine dispatches.
 */
type LoopCountingWindow = Window & { __resizeObserverLoops?: number };

const countLoops = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    window.addEventListener('error', (event) => {
      if (/^ResizeObserver loop/.test(event.message)) {
        const counting = window as LoopCountingWindow;
        counting.__resizeObserverLoops = (counting.__resizeObserverLoops ?? 0) + 1;
      }
    });
  });
};

const settle = (page: Page): Promise<void> =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

const loops = async (page: Page): Promise<number> => {
  await settle(page);
  return page.evaluate(() => (window as LoopCountingWindow).__resizeObserverLoops ?? 0);
};

const resizeThrough = async (page: Page, widths: number[]): Promise<void> => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await settle(page);
  }
};

/** Twelve values under a label long enough that the pager takes its own row at narrow widths. */
const twelveAuthorityValues = async (page: Page): Promise<void> => {
  await page.route('**/fixtures/24-multi-authority-values.json', async (route) => {
    const response = await route.fetch();
    const template = await response.json();
    template._ui.propertyLabels._author = 'Chemical compound identified in the collected environmental sample';
    template._ui.propertyDescriptions._author = '';
    template.properties._author.items._ui.inputType = 'ext-pfas';
    template.properties._author.items['schema:description'] = '';
    await route.fulfill({ response, json: template });
  });
  await page.route('**/fixtures/24-multi-authority-values-instance.json', async (route) => {
    const response = await route.fetch();
    const instance = await response.json();
    instance._author = Array.from({ length: 12 }, (_, i) => ({
      '@id': `https://comptox.epa.gov/dashboard/chemical/details/DTXSID${i + 3031864}`,
      'rdfs:label': `Hexafluoropropylene oxide dimer acid ${i + 1}`,
    }));
    await route.fulfill({ response, json: instance });
  });
};

test(`revealing a hidden host places a repeated field's pager without a ResizeObserver loop ${WIDTH_INDEPENDENT}`, async ({
  page,
}) => {
  await countLoops(page);
  await twelveAuthorityValues(page);
  await page.route('**/host.html?**', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      '</head>',
      '<style id="loading-host">#frame { display: none !important; }</style></head>',
    );
    await route.fulfill({ response, body });
  });
  await page.setViewportSize({ width: 768, height: 900 });
  await open(
    page,
    '24-multi-authority-values',
    undefined,
    '24-multi-authority-values-instance',
    undefined,
    '&f=wrapFieldNames',
  );
  await page.evaluate(() => document.getElementById('loading-host')!.remove());
  await expect(page.locator('cedar-embeddable-editor app-cedar-multi-pager').first()).toBeVisible();
  expect(await loops(page)).toBe(0);
});

test(`resizing a field whose pager stacks and unstacks raises no ResizeObserver loop ${WIDTH_INDEPENDENT}`, async ({
  page,
}) => {
  await countLoops(page);
  await twelveAuthorityValues(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(
    page,
    '24-multi-authority-values',
    undefined,
    '24-multi-authority-values-instance',
    undefined,
    '&f=wrapFieldNames',
  );
  await resizeThrough(page, [768, 375, 1280, 700, 1000]);
  expect(await loops(page)).toBe(0);
});

test(`resizing expanded nested elements raises no ResizeObserver loop ${WIDTH_INDEPENDENT}`, async ({ page }) => {
  await countLoops(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '03-nested-multi');
  await page.locator('cedar-embeddable-editor').getByRole('button', { name: 'Expand All', exact: true }).click();
  await settle(page);
  await resizeThrough(page, [768, 375, 1280]);
  expect(await loops(page)).toBe(0);
});

test(`resizing a long paragraph that rewraps raises no ResizeObserver loop ${WIDTH_INDEPENDENT}`, async ({ page }) => {
  await countLoops(page);
  const sentence = 'Specimens were collected along the northern coastal transect and stored at four degrees. ';
  await page.route('**/fixtures/01-input-types-instance.json', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json._textarea = { '@value': sentence.repeat(12).trim() };
    await route.fulfill({ response, json });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '01-input-types', undefined, '01-input-types-instance');
  await resizeThrough(page, [375, 1280, 500]);
  const paragraph = page.locator('cedar-embeddable-editor textarea').first();
  await expect.poll(() => paragraph.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
  expect(await loops(page)).toBe(0);
});
