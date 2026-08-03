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
   * One retry, so an intermittent failure is reported as flaky rather than as
   * a regression — Playwright counts and prints those separately, so nothing is
   * hidden, and `trace: 'retain-on-failure'` still captures the first attempt.
   *
   * Earned: two runs out of roughly a dozen have failed a single screenshot
   * immediately after a fresh bundle and passed on every re-run, and the cause
   * has not been reproduced on demand. With no retries there is no way to tell
   * that apart from a real regression, which is the worse failure mode of the
   * two. Raise this to a real fix once a trace shows what it is.
   */
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://127.0.0.1:4455',
    // Screenshots only; no video or trace by default — this suite runs often.
    trace: 'retain-on-failure',
  },

  expect: {
    toHaveScreenshot: {
      // Font rasterisation differs a little between machines and OS versions.
      // A small ratio absorbs that without hiding a real layout change; a
      // Material DOM rewrite moves far more than 1% of pixels.
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'narrow', use: { ...devices['Desktop Chrome'], viewport: { width: 480, height: 900 } } },
  ],

  webServer: {
    // `npx serve` would add a dependency; python3 ships with macOS and is
    // enough for static files.
    command: 'python3 -m http.server 4455 --directory public',
    url: 'http://127.0.0.1:4455/host.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
