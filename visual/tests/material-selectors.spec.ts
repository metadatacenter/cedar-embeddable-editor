/**
 * Every Material class CEE reaches into must still match something.
 *
 * THEMING.md's third question about a failing snapshot is "is a CEE rule now
 * dead?", because a rule targeting a renamed class stops applying in silence and
 * the symptom — a control reverting to Material's defaults — reads as an
 * innocuous restyle. The MDC migration proved the point: three rules died that
 * way, and only one of them was obvious in a diff image.
 *
 * So the inventory in THEMING.md is executed here rather than maintained by hand.
 * The selectors are read from CEE's own stylesheets at run time, so adding a rule
 * adds a check, and a Material rename fails this suite with the selector named
 * instead of leaving 60 screenshots to interpret.
 */
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from './support/host';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

const scssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? scssFiles(p) : p.endsWith('.scss') ? [p] : [];
  });

/**
 * Reachable only in a state this suite does not create, so absence here says
 * nothing. Keep the list short and justified — it is the escape hatch that would
 * quietly empty the check if it grew.
 */
const UNREACHABLE = new Map([
  ['.mat-mdc-progress-spinner', 'only while an authority lookup is in flight'],
  ['.mat-mdc-tooltip', 'only while a tooltip is open, which needs a real hover'],
]);

/** Comments mention class names they do not style, so they are stripped first. */
const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const declared = [
  ...new Set(
    scssFiles(SRC).flatMap((f) =>
      [...withoutComments(readFileSync(f, 'utf8')).matchAll(/\.(?:mat|mdc|ng)-[a-z0-9_-]+/g)].map((m) => m[0]),
    ),
  ),
].sort();

test('every third-party selector CEE styles still matches an element', async ({ page }) => {
  const seen = new Set<string>();
  const sweep = async () => {
    for (const sel of declared) {
      if (seen.has(sel)) continue;
      if (await page.locator(sel).count()) seen.add(sel);
    }
  };

  await open(page, '01-input-types');
  await sweep();
  await open(page, '03-nested-multi');
  await sweep();
  // Page breaks, for the paginator classes.
  await open(page, '05-static-paged');
  await sweep();
  // The temporal fixture with the optional UTC-offset control.
  await open(page, '07-timezone');
  await sweep();

  // An open select panel, for the option classes.
  await open(page, '02-choices');
  await page.locator('mat-select').first().click();
  await page.waitForTimeout(300);
  await sweep();

  // An open datepicker, for the calendar classes.
  await open(page, '09-temporal');
  await page.locator('mat-datepicker-toggle button').first().click();
  await page.waitForTimeout(300);
  await sweep();

  // The preferences menu, for the menu classes.
  await open(page, '01-input-types', 'chrome');
  await page.locator('user-preferences-menu button').first().click();
  await page.waitForTimeout(300);
  await sweep();

  const dead = declared.filter((s) => !seen.has(s) && !UNREACHABLE.has(s));
  expect(dead, 'these classes are styled by CEE but match nothing — the library renamed them').toEqual([]);
  expect(declared.length, 'no selectors were collected; the source scan is broken').toBeGreaterThan(10);
});

/**
 * The commitments THEMING.md calls load-bearing, checked rather than grepped.
 *
 * The `--cee-*` properties are published on `:host` for embedders to override, and
 * two have no internal consumer — which is the point, and also what makes them easy
 * to drop by accident during a Material migration. The font faces are namespaced so
 * an embedding page cannot collide with them, and the status colours are plain CSS
 * that should survive any Material change untouched; if one of them moves, something
 * reached into it.
 */
test('the public custom properties and namespaced faces survive', async ({ page }) => {
  await open(page, '01-input-types');

  const host = page.locator('cedar-embeddable-editor');
  for (const prop of ['--cee-color-primary', '--cee-color-text-primary', '--cee-color-accent', '--cee-color-warn']) {
    const value = await host.evaluate((n, p) => getComputedStyle(n).getPropertyValue(p).trim(), prop);
    expect(value, `${prop} is public API and must stay published on :host`).not.toBe('');
  }

  const fonts = await page.evaluate(() => {
    const faces: string[] = [];
    document.fonts.forEach((f) => faces.push(f.family));
    return faces;
  });
  expect(fonts, 'CEE namespaces its faces so an embedder cannot collide with them').toEqual(
    expect.arrayContaining(['CEE Roboto', 'CEE Material Icons']),
  );
});
