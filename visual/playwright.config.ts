import { defineConfig, devices } from '@playwright/test';

/**
 * Visual baseline for the built web component.
 *
 * Points at `public/`, which holds the concatenated bundle exactly as an
 * embedder would consume it — not the dev server. That distinction matters:
 * the thing shipped to hosts is the concat of runtime + polyfills + main, and
 * an upgrade that breaks the bundle while leaving `ng serve` working is
 * precisely the failure this is here to catch.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /**
   * No retry locally: a flake here is a failure, and should look like one.
   *
   * There was one. Two runs out of roughly a dozen failed a single screenshot
   * immediately after a fresh bundle and passed on every re-run, so a retry was
   * added to tell that apart from a real regression while the cause was unknown.
   *
   * The cause was very likely this: the dev server sends no `Cache-Control`, and
   * HTTP then lets a browser reuse a cached response *heuristically*, without
   * revalidating — so a run straight after a re-bundle could render the previous
   * build. `host.html` now loads the bundle at a URL keyed to its mtime, and a
   * test asserts the versioned URL is what actually gets fetched.
   *
   * The evidence for dropping the retry, rather than a feeling that it is fixed:
   *
   * - 40 consecutive runs at `--retries=0` on one bundle — clean.
   * - 15 consecutive runs at `--retries=0`, each preceded by a fresh
   *   `npm run bundle`, which is the condition the failures actually appeared
   *   under — clean.
   *
   * At the observed rate of roughly two in twelve, 55 clean runs has a
   * probability around 2e-5. `npm run flake-hunt` (RUNS=n) repeats the suite if
   * this needs re-establishing.
   *
   * CI keeps one retry, for a different reason: shared runners contribute their
   * own timeouts and network failures, which are not this flake and not CEE's
   * bug. Playwright counts and prints retried tests separately, so nothing is
   * hidden either way.
   */
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://127.0.0.1:4455',
    // Screenshots only; no video or trace by default — this suite runs often.
    trace: 'retain-on-failure',
  },

  expect: {
    toHaveScreenshot: {
      // Font rasterisation differs a little between machines and OS versions,
      // and this ratio absorbs that. It catches what it was chosen to catch: a
      // Material DOM rewrite moves far more than 1% of pixels.
      //
      // What it does NOT catch is a localised change to a small part of a tall
      // page. Measured: rebranding the whole footer — logo, organisation name
      // and link — moved 0.708% of the desktop page and 0.897% of the narrow
      // one, and both reported green. Anything that matters within a region
      // smaller than roughly 1% of its page needs a screenshot clipped to that
      // region, where the same ratio is a much smaller absolute budget, or a
      // DOM assertion. See `the footer` and `pager.png` in render.spec.ts.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  projects: [
    {
      name: 'desktop',
      testIgnore: /cross-browser-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'narrow',
      testIgnore: /cross-browser-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 480, height: 900 } },
    },
    {
      name: 'chromium-smoke',
      testMatch: /cross-browser-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'firefox-smoke',
      testMatch: /cross-browser-smoke\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'webkit-smoke',
      testMatch: /cross-browser-smoke\.spec\.ts/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: {
    // Was `python3 -m http.server`, on the reasoning that python3 ships with macOS.
    // GitHub's macos-15 image has no python3 on PATH, and the failure was invisible:
    // the process produced no output and Playwright reported only its generic
    // webServer timeout. serve-public.mjs depends on Node, which this suite already
    // requires, and adds no npm dependency.
    command: 'node serve-public.mjs 4455',
    url: 'http://127.0.0.1:4455/host.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
