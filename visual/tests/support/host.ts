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

/**
 * Let a debounced search fire under a frozen clock.
 *
 * The screenshots need `Date.now()` pinned, because CEE seeds its temporal controls
 * from it and a second ticking over between the seed and the capture is a diff. But
 * rxjs 7 rewrote `debounceTime` to compare `scheduler.now()` against `lastTime +
 * dueTime` rather than to lean on `setTimeout` alone, so under a clock that never
 * advances it reschedules itself forever and the search is never issued. rxjs 6 had
 * no such comparison, which is why this was invisible until the bump.
 *
 * Nothing about that is a defect in CEE: no real clock is frozen. What it does mean
 * is that a suite freezing time has to say when a debounce window has passed, rather
 * than assume wall-clock does it. Called after typing, before awaiting the request.
 *
 * A minute is far past every debounce in the editor (400ms and 500ms) and is not a
 * wait — `setFixedTime` does not fake timers, so the already-scheduled task simply
 * finds the window elapsed on its next tick.
 */
export const passDebounceWindow = async (page: Page): Promise<void> => {
  await page.clock.setFixedTime(new Date(FROZEN.getTime() + 60_000));
};

/** The stub served in place of every image a template points at an outside host. */
const STUB_IMAGE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), './stub-image.png');

/**
 * Serve the outside world from disk, and fail if a page reaches for anything else.
 *
 * Generated fixtures reference nothing off-origin. Templates written by a person do:
 * the two real ones here embed the CEDAR logo from the public site and a YouTube
 * video. Left alone, each screenshot would depend on a third party being reachable
 * and on neither of them restyling — a baseline that goes red for reasons no commit
 * in this repository caused. So both are answered locally, with fixed bytes.
 *
 * They are answered rather than blocked because CEE renders a *failed* image as an
 * error notice instead of a picture (`resolveStaticImageView`), which would take the
 * card out of the layout the screenshot is here to watch.
 *
 * The third is not the templates' doing. CEE's own ROR icon is a `background-image`
 * pointing at raw.githubusercontent.com — alone among the five authority icons, which
 * are otherwise inlined as `data:` SVGs — so any fixture holding an `ext-ror` field
 * fetches it. That includes `04-controlled-terms` and `08-authority`, whose baselines
 * have therefore always been network-dependent without saying so. Stubbed here rather
 * than fixed, because inlining it changes what those two render and belongs in its own
 * commit with its own re-baseline.
 *
 * The unmatched-host route is the part worth keeping, and it earned that on its first
 * run by finding the ROR icon. It aborts anything else and records it, so
 * `expectNoStrayHosts` fails a fixture that quietly starts depending on the network
 * instead of letting it become another silent one.
 */
export const hermetic = async (page: Page): Promise<string[]> => {
  const stray: string[] = [];

  // Registered first on purpose: Playwright tries the most recently added route
  // first, so the catch-all has to go down before the stubs that must outrank it.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => {
    stray.push(route.request().url());
    return route.abort();
  });

  await page.route('https://cedar.metadatacenter.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: fs.readFileSync(STUB_IMAGE) }),
  );

  await page.route('https://www.youtube.com/embed/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>stub</title>' }),
  );

  await page.route('https://raw.githubusercontent.com/ror-community/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='#53baa1'/></svg>",
    }),
  );

  return stray;
};

/** Assert the page reached for nothing beyond what `hermetic` answers. */
export const expectNoStrayHosts = (stray: string[]): void => {
  expect([...new Set(stray)], 'fixture reached an unstubbed external host').toEqual([]);
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
