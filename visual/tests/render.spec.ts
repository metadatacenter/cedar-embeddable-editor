/**
 * Visual baseline.
 *
 * This is the half of the test strategy the domain harness deliberately does
 * not cover. `harness/` imports no Angular precisely so it survives the
 * framework upgrade untouched — which also means it cannot see a single thing
 * about how CEE *looks*. Material 15 rewrote every component's DOM structure
 * and CSS class names, and CEE has 42 SCSS files plus
 * `ViewEncapsulation.None`, which is load-bearing: it is how the web component
 * styles itself. Only pixels catch that.
 *
 * Capture these baselines BEFORE the 14 → 15 hop. Afterwards they are just a
 * record of whatever the migration did.
 */
import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

const FIXTURES = [
  ['01-input-types', 'every simple input type'],
  ['02-choices', 'radio, checkbox and list widgets'],
  ['03-nested-multi', 'multi-instance elements nested two deep'],
  ['04-controlled-terms', 'controlled term and external authority widgets'],
  ['05-static-paged', 'static content and page breaks'],
  ['06-validation', 'fields that can show validation errors'],
  ['07-timezone', 'temporal field with the timezone picker'],
  ['08-authority', 'every external authority widget'],
] as const;

/**
 * A fixed instant for every run.
 *
 * CEE seeds a temporal field's date and time from `new Date()` at component
 * init, so any fixture containing one renders the current wall clock. Without
 * pinning it, `01-input-types` and every preset built on it change every
 * minute — a baseline that rots on a timer, which looks exactly like a real
 * regression and trains people to re-record instead of investigate.
 *
 * `setFixedTime` only pins `Date`; it does not fake timers, so Angular's
 * animations and the settle poll still run normally.
 */
const FROZEN = new Date('2026-01-01T09:30:00Z');

/**
 * A cache-buster keyed to the bundle, not to the clock.
 *
 * The dev server sends no `Cache-Control`, so a browser may reuse a cached
 * bundle heuristically without revalidating — which after a re-bundle means
 * rendering the previous build, and is the most likely explanation for the
 * occasional single-screenshot failure that only ever appeared right after
 * building. Read once per run: stable across the run's tests, different as soon
 * as the file is rebuilt.
 *
 * Deliberately not wrapped in a try/catch. The first version of this was, and
 * the fallback constant hid the fact that `__dirname` does not exist in this
 * package — it is ESM — so the buster was a no-op that looked like a fix. A
 * missing bundle should stop the run, and `check-bundle-fresh.mjs` says so more
 * clearly anyway.
 */
const BUNDLE_VERSION = String(
  fs.statSync(path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../public/cedar-embeddable-editor.js'))
    .mtimeMs,
);

/** Load a fixture, optionally under a config preset, and wait for it to settle. */
const open = async (page: import('@playwright/test').Page, fixture: string, preset?: string) => {
  await page.clock.setFixedTime(FROZEN);
  await page.goto(`/host.html?t=${fixture}${preset ? `&c=${preset}` : ''}&b=${BUNDLE_VERSION}`);
  await page.waitForFunction(() => (window as any).__ceeReady === true || (window as any).__ceeError, null, {
    timeout: 20_000,
  });
  const err = await page.evaluate(() => (window as any).__ceeError);
  expect(err, `host page failed to load ${fixture}`).toBeFalsy();
  // Material ripples and expansion-panel transitions.
  await page.waitForTimeout(300);
};

for (const [fixture, description] of FIXTURES) {
  test(`${fixture} — ${description}`, async ({ page }) => {
    await open(page, fixture);
    await expect(page).toHaveScreenshot(`${fixture}.png`, { fullPage: true });
  });
}

test('multi-instance pager renders its chips', async ({ page }) => {
  await open(page, '03-nested-multi');
  // The pager is the most Material-dependent control in the editor: chips,
  // ripples and an icon button row. Screenshot it in isolation so a diff here
  // is unambiguous.
  const pager = page.locator('app-cedar-multi-pager').first();
  await expect(pager).toBeVisible();
  await expect(pager).toHaveScreenshot('pager.png');
});

test('an expansion panel collapses and expands', async ({ page }) => {
  await open(page, '03-nested-multi');
  const header = page.locator('mat-expansion-panel-header').first();
  await expect(header).toBeVisible();

  /**
   * Click the title, not the header's centre.
   *
   * The multi-instance pager is rendered with `isAlignedUp`, which pulls its
   * chip row up into the header band. At 480px the chips reach the horizontal
   * centre, so a default centre-click lands on a MAT-CHIP — Playwright's
   * actionability check sees the wrong element and waits until timeout.
   *
   * Worth noting beyond the test: at narrow widths a user aiming for the
   * middle of that header hits a page chip and switches instance instead of
   * collapsing.
   */
  await header.locator('mat-panel-title').click({ position: { x: 8, y: 16 } });
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot('nested-collapsed.png', { fullPage: true });
});

test('a required field shows its indicator', async ({ page }) => {
  await open(page, '01-input-types');
  // `text` is the one deployed with withRequiredValue(true).
  await expect(page.getByText('text', { exact: false }).first()).toBeVisible();
  await expect(page).toHaveScreenshot('required-indicator.png', { fullPage: true });
});

/**
 * State coverage.
 *
 * The fixture screenshots above all capture an empty form in its default
 * configuration. That leaves whole Material surfaces unrendered — an audit of
 * the baselines against CEE's templates found 13 element types appearing in no
 * screenshot at all, led by `mat-error` (30 template occurrences) and
 * `mat-option` (26). Both only exist in a state a default-state screenshot
 * never reaches: a touched control, and an open overlay.
 *
 * That matters specifically for the Angular 15 hop. MDC restructured the
 * `mat-form-field` subscript wrapper, where errors and hints live, and moved
 * overlay positioning — so the two biggest gaps sat exactly on the two biggest
 * risks.
 */
test.describe('validation states', () => {
  /**
   * Touch each required field and leave it empty.
   *
   * Material's default ErrorStateMatcher only shows `mat-error` once a control
   * is touched or dirty, so focusing and blurring is the whole trick — no
   * invalid input is needed for the `required` case.
   */
  test('required fields show errors once touched', async ({ page }) => {
    await open(page, '06-validation');

    // Fields are addressed by aria-label, which carries the template property
    // name. Type attributes are not usable here: CEE renders email, link and
    // phone fields as `type="text"` and validates them on the FormControl.
    const names = ['required_text', 'short_text', 'an_email', 'a_link', 'a_phone'];
    for (const name of names) {
      const input = page.locator(`input[aria-label="${name}"]`);
      await expect(input).toBeVisible();
      await input.focus();
      await input.blur();
    }
    await page.waitForTimeout(300);

    await expect(page.locator('mat-error').first()).toBeVisible();
    await expect(page).toHaveScreenshot('validation-required.png', { fullPage: true });
  });

  test('an invalid email shows its own error', async ({ page }) => {
    await open(page, '06-validation');

    const email = page.locator('input[aria-label="an_email"]');
    await email.fill('not-an-email');
    await email.blur();
    await page.waitForTimeout(300);

    await expect(page.locator('mat-error').first()).toBeVisible();
    await expect(page).toHaveScreenshot('validation-email.png', { fullPage: true });
  });

  test('text below its minLength shows the length error', async ({ page }) => {
    await open(page, '06-validation');

    // `short_text` carries withMinLength(8).
    const short = page.locator('input[aria-label="short_text"]');
    await short.fill('abc');
    await short.blur();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('validation-minlength.png', { fullPage: true });
  });
});

test.describe('open overlays', () => {
  /**
   * `mat-option` renders only while a panel is open, and overlays are attached
   * to the CDK overlay container rather than in place — a separate positioning
   * path from everything else in these baselines.
   */
  test('a select panel renders its options', async ({ page }) => {
    await open(page, '02-choices');

    await page.locator('mat-select').first().click();
    await page.waitForTimeout(400);

    await expect(page.locator('mat-option').first()).toBeVisible();
    await expect(page).toHaveScreenshot('overlay-select-open.png', { fullPage: true });
  });
});

test.describe('filled state', () => {
  test('values render in the fields that hold them', async ({ page }) => {
    await open(page, '01-input-types');

    await page.locator('input[aria-label="text"]').fill('a filled value');
    await page.locator('textarea[aria-label="textarea"]').fill('a longer\nfilled value');
    await page.locator('input[aria-label="numeric"]').fill('42');
    await page.locator('input[aria-label="email"]').fill('someone@example.org');
    await page.locator('input[aria-label="link"]').fill('https://example.org/thing');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('filled-values.png', { fullPage: true });
  });
});

test.describe('config presets', () => {
  /**
   * The base preset hides the header, footer and preferences menu so diffs
   * reflect the form. This covers them, and with them `mat-toolbar` and
   * `mat-slide-toggle`, which appear in no other baseline.
   */
  test('chrome: header, footer and preferences menu', async ({ page }) => {
    await open(page, '01-input-types', 'chrome');
    await expect(page).toHaveScreenshot('preset-chrome.png', { fullPage: true });
  });

  /**
   * Read-only mode swaps inputs for plain text in several widgets and
   * suppresses every `mat-error`. The domain suite covers the flag; nothing
   * covered what it looks like.
   */
  test('readonly: inputs are not editable', async ({ page }) => {
    await open(page, '01-input-types', 'readonly');
    await expect(page).toHaveScreenshot('preset-readonly.png', { fullPage: true });
  });

  test('readonly: choice widgets', async ({ page }) => {
    await open(page, '02-choices', 'readonly');
    await expect(page).toHaveScreenshot('preset-readonly-choices.png', { fullPage: true });
  });
});

/**
 * External authority fields — ORCID, ROR, PFAS, PubMed, RRID, NIH Grant, DOI.
 *
 * These are search boxes, not value boxes. The control holds whatever the user
 * is typing, and after a selection it holds `"Label - https://iri"`; the IRI
 * itself only ever reaches the model. A validator that checks the control's
 * contents for a well-formed IRI therefore rejects every intermediate state,
 * which is how "Entered value is not a valid RRID and has been cleared."
 * came to appear on the first keystroke — over a field that had not been
 * cleared, above an autocomplete that was working.
 *
 * No screenshot: this asserts behaviour rather than pixels, and a baseline
 * image would make it fail for unrelated styling changes.
 */
test.describe('external authority fields', () => {
  test('typing does not raise an error', async ({ page }) => {
    await open(page, '04-controlled-terms');

    const orcid = page.locator('input[aria-label="contributor"]');
    await expect(orcid).toBeVisible();
    await orcid.pressSequentially('dav', { delay: 60 });
    await page.waitForTimeout(600);

    await expect(
      page.locator('mat-error'),
      'a partly typed search term is not an invalid value',
    ).toHaveCount(0);
  });

  test('the character typed is not swallowed', async ({ page }) => {
    await open(page, '04-controlled-terms');

    const orcid = page.locator('input[aria-label="contributor"]');
    await orcid.pressSequentially('dav', { delay: 60 });
    await page.waitForTimeout(600);

    await expect(orcid).toHaveValue('dav');
  });

  /**
   * The message is real, at the right moment: free text that names no term is
   * discarded on blur, and *then* the field says so.
   */
  test('free text is reported once it has actually been discarded', async ({ page }) => {
    await open(page, '04-controlled-terms');

    const orcid = page.locator('input[aria-label="contributor"]');
    await orcid.pressSequentially('not a real researcher', { delay: 20 });
    await page.waitForTimeout(600);
    await orcid.blur();
    await page.waitForTimeout(600);

    await expect(orcid).toHaveValue('');
    await expect(page.locator('mat-error')).toHaveCount(1);
  });
});

/**
 * All seven authority widgets, on the one fixture that carries them.
 *
 * `04-controlled-terms` has only ORCID and ROR, and the other five are copies
 * of those two that had drifted — which is why a defect present in six of them
 * went unseen. Parameterised so a new authority type is covered by adding one
 * line to `generate-fixtures.mjs`.
 */
const AUTHORITY_FIELDS = [
  ['contributor_orcid', 'ORCID'],
  ['institution_ror', 'ROR'],
  ['chemical_pfas', 'PFAS'],
  ['citation_pmid', 'PubMed'],
  ['resource_rrid', 'RRID'],
  ['award_nih', 'NIH Grant'],
  ['dataset_doi', 'DOI'],
] as const;

test.describe('every external authority widget', () => {
  for (const [name, label] of AUTHORITY_FIELDS) {
    /**
     * REGRESSION: a validator pointed at the search control instead of the
     * stored value rejected every intermediate state, so the field said "not a
     * valid X and has been cleared" on the first keystroke — over a field that
     * had not been cleared, above a working autocomplete.
     */
    test(`${label}: typing raises no error and keeps the text`, async ({ page }) => {
      await open(page, '08-authority');

      const input = page.locator(`input[aria-label="${name}"]`);
      await expect(input).toBeVisible();
      await input.pressSequentially('dav', { delay: 40 });
      await page.waitForTimeout(500);

      await expect(page.locator('mat-error')).toHaveCount(0);
      await expect(input).toHaveValue('dav');
    });

    /**
     * REGRESSION: six of the seven left free text in the box on blur, over an
     * instance holding nothing — the field looked filled and read back blank.
     * ORCID was the only one that reconciled; ROR had the machinery but never
     * bound it to a blur event, and the other five had no blur handler at all.
     */
    test(`${label}: free text is discarded on blur, and said so`, async ({ page }) => {
      await open(page, '08-authority');

      const input = page.locator(`input[aria-label="${name}"]`);
      await input.pressSequentially('zzz nonsense', { delay: 15 });
      await page.waitForTimeout(500);
      await input.blur();
      await page.waitForTimeout(600);

      await expect(input, 'text naming no term cannot be saved, so it must not linger').toHaveValue('');
      await expect(page.locator('mat-error')).toHaveCount(1);
    });

    /** Each widget's message names its own authority. */
    test(`${label}: the message names the right authority`, async ({ page }) => {
      await open(page, '08-authority');

      const input = page.locator(`input[aria-label="${name}"]`);
      await input.pressSequentially('zzz nonsense', { delay: 15 });
      await page.waitForTimeout(500);
      await input.blur();
      await page.waitForTimeout(600);

      await expect(page.locator('mat-error')).toContainText(label);
    });
  }
});

/**
 * The cache-busting itself, because it is the kind of fix that can silently stop
 * working.
 *
 * The first attempt did exactly that: it resolved the bundle path with
 * `__dirname`, which does not exist in this package, and a `try/catch` turned the
 * failure into a constant — so every run requested the same URL and nothing was
 * busted. It passed 86 tests while doing nothing.
 */
test.describe('the served bundle', () => {
  test('is fetched at a URL keyed to its mtime', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('cedar-embeddable-editor.js')) {
        requested.push(r.url());
      }
    });

    await open(page, '01-input-types');

    expect(requested, 'the bundle should be fetched exactly once').toHaveLength(1);
    expect(requested[0], 'the URL carries the bundle version').toContain(`?b=${BUNDLE_VERSION}`);
    expect(BUNDLE_VERSION, 'the version is the real mtime, not a fallback').toMatch(/^\d+/);
  });
});
