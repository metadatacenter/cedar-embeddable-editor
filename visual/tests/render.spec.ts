/**
 * Visual baseline.
 *
 * This is the half of the test strategy the domain harness deliberately does
 * not cover. `harness/` imports no Angular precisely so it survives the
 * framework upgrade untouched — which also means it cannot see a single thing
 * about how CEE *looks*. Material 15 rewrote every component's DOM structure
 * and CSS class names, while CEE still has 42 SCSS files and substantial
 * Material theming inside its shadow boundary. Only pixels catch that.
 *
 * Capture these baselines BEFORE the 14 → 15 hop. Afterwards they are just a
 * record of whatever the migration did.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BUNDLE_VERSION,
  FROZEN,
  expectNoStrayHosts,
  hermetic,
  open,
  openTwoEditors,
  passDebounceWindow,
} from './support/host';

const FIXTURES = [
  ['01-input-types', 'every simple input type'],
  ['02-choices', 'radio, checkbox and list widgets'],
  ['03-nested-multi', 'multi-instance elements nested two deep'],
  ['04-controlled-terms', 'controlled term and external authority widgets'],
  ['05-static-paged', 'static content and page breaks'],
  ['06-validation', 'fields that can show validation errors'],
  ['07-timezone', 'temporal field with the timezone picker'],
  ['08-authority', 'every external authority widget'],
  ['09-temporal', 'temporal fields at every granularity'],
  ['10-attribute-values', 'attribute-value fields, whose names come from the user'],
  ['12-render-decision', 'whether a multi field renders its content, in all three cases'],
  ['13-paged-choice', 'a choice field inside a multi-instance element'],
] as const;

test.describe('host style isolation', () => {
  test('host and editor styles do not cross the custom-element boundary', async ({ page }) => {
    await open(page, '01-input-types');
    await page.addStyleTag({
      content: `
        cedar-embeddable-editor input {
          background: rgb(255, 0, 0) !important;
          font-size: 2px !important;
        }
      `,
    });

    const inputStyle = await page.locator('input[aria-label="text"]').evaluate((input) => {
      const style = getComputedStyle(input);
      return { background: style.backgroundColor, fontSize: style.fontSize };
    });
    expect(inputStyle.background).not.toBe('rgb(255, 0, 0)');
    expect(inputStyle.fontSize).not.toBe('2px');

    const hostProbe = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.className = 'material-icons';
      probe.textContent = 'host text';
      document.body.appendChild(probe);
      const style = getComputedStyle(probe);
      return { display: style.display, fontFamily: style.fontFamily };
    });
    expect(hostProbe.display).toBe('inline');
    expect(hostProbe.fontFamily).not.toContain('Material Icons');
  });

  test('Material overlays stay inside the editor shadow root', async ({ page }) => {
    await open(page, '02-choices');
    await page.locator('mat-select').first().click();
    await expect(page.locator('mat-option').first()).toBeVisible();

    const placement = await page.evaluate(() => {
      const editor = document.querySelector('cedar-embeddable-editor') as HTMLElement;
      return {
        inside: editor.shadowRoot?.querySelectorAll('.cee-overlay-container mat-option').length ?? 0,
        outside: document.body.querySelectorAll(':scope > .cdk-overlay-container').length,
      };
    });
    expect(placement.inside).toBeGreaterThan(0);
    expect(placement.outside).toBe(0);
  });

  /**
   * Teardown, which used to be a unit spec and could not stay one.
   *
   * `CedarOverlayContainer` extends the CDK's `OverlayContainer`, and from Angular
   * 19 that base resolves its dependencies in field initializers — including a
   * private `_CdkPrivateStyleLoader`. Constructing it outside an injection context
   * throws, and satisfying that by hand means providing CDK internals that are not
   * API and will move again. The unit spec was deleted rather than propped up; the
   * unit setup deliberately has no TestBed and no zone, and one spec is not worth
   * patching globals for all 107 others.
   *
   * Nothing is lost by asserting it here instead. The container's whole purpose is
   * to live in a real shadow root, so the real element is the honest place to check
   * that destroying the editor takes the container with it. A container left behind
   * would leak a detached overlay host into any host page that mounts CEE twice.
   */
  test('destroying the editor removes its overlay container', async ({ page }) => {
    await open(page, '02-choices');
    await page.locator('mat-select').first().click();
    await expect(page.locator('mat-option').first()).toBeVisible();

    const counts = await page.evaluate(() => {
      const editor = document.querySelector('cedar-embeddable-editor') as HTMLElement;
      const before = editor.shadowRoot?.querySelectorAll('.cee-overlay-container').length ?? 0;
      editor.remove();
      return { before, afterInDocument: document.querySelectorAll('.cee-overlay-container').length };
    });

    expect(counts.before, 'the overlay container should exist while the editor does').toBe(1);
    expect(counts.afterInDocument, 'the overlay container outlived the editor').toBe(0);
  });
});

test.describe('multiple editor instances', () => {
  test('keep language paths, IRI prefixes and preferences isolated', async ({ page }) => {
    const languageRequests: string[] = [];
    await page.route('**/served/languages/**', async (route) => {
      languageRequests.push(route.request().url());
      await route.fulfill({ status: 404, body: '' });
    });

    await openTwoEditors(page, '03-nested-multi');
    await expect
      .poll(() => languageRequests.some((request) => request.includes('/languages/first/en.json')))
      .toBe(true);
    await expect
      .poll(() => languageRequests.some((request) => request.includes('/languages/second/en.json')))
      .toBe(true);

    const ids = await page.evaluate(() => {
      const collect = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.flatMap(collect);
        if (value && typeof value === 'object') {
          const record = value as Record<string, unknown>;
          return [
            typeof record['@id'] === 'string' ? record['@id'] : '',
            ...Object.values(record).flatMap(collect),
          ].filter(Boolean);
        }
        return [];
      };
      const first = document.querySelector('#editor-first') as any;
      const second = document.querySelector('#editor-second') as any;
      return { first: collect(first.currentMetadata), second: collect(second.currentMetadata) };
    });
    const firstElementIds = ids.first.filter((id) => id.includes('template-element-instances'));
    const secondElementIds = ids.second.filter((id) => id.includes('template-element-instances'));
    expect(firstElementIds.length).toBeGreaterThan(0);
    expect(secondElementIds.length).toBeGreaterThan(0);
    expect(firstElementIds.every((id) => id.startsWith('https://first.example/'))).toBe(true);
    expect(secondElementIds.every((id) => id.startsWith('https://second.example/'))).toBe(true);

    const firstInput = page.locator('#editor-first input').first();
    const secondInput = page.locator('#editor-second input').first();
    await page.locator('#editor-first button[aria-label="Open preferences menu"]').click();
    await page.getByText('Readonly Mode', { exact: true }).click();
    await expect(firstInput).toHaveAttribute('readonly', 'true');
    await expect(secondInput).not.toHaveAttribute('readonly', '');
  });

  test('keep terminology and authority endpoints isolated', async ({ page }) => {
    await page.route('**/isolation/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ found: true, results: {}, collection: [] }),
      });
    });
    await page.route('**/served/languages/**', async (route) => route.fulfill({ status: 404, body: '' }));

    await openTwoEditors(page, '04-controlled-terms');
    const terminologyRequest = page.waitForRequest((request) => request.url().includes('/isolation/first/terminology'));
    await page.locator('#editor-first input[aria-label="organism"]').pressSequentially('human', { delay: 40 });
    await passDebounceWindow(page);
    expect((await terminologyRequest).url()).toContain('/isolation/first/terminology');

    await openTwoEditors(page, '08-authority');
    const authorityRequest = page.waitForRequest((request) =>
      request.url().includes('/isolation/first/authority/pfas/search'),
    );
    await page.locator('#editor-first input[aria-label="chemical_pfas"]').pressSequentially('chemical', { delay: 40 });
    await passDebounceWindow(page);
    expect((await authorityRequest).url()).toContain('/isolation/first/authority/pfas/search');
  });
});

for (const [fixture, description] of FIXTURES) {
  test(`${fixture} — ${description}`, async ({ page }) => {
    await open(page, fixture);
    await expect(page).toHaveScreenshot(`${fixture}.png`, { fullPage: true });
  });
}

/**
 * Two templates a person authored in the Template Designer, exported from a running
 * CEDAR stack and committed unedited.
 *
 * Every other fixture here is generated by the CEDAR Model TypeScript Library, which
 * makes the whole visual suite an argument CEE has with itself: the generator emits
 * what the library thinks a template is, and CEE renders what it thinks that is. The
 * long tail of `_ui` metadata, key ordering and cardinality that the Template Designer
 * actually writes is on neither side of it. The domain harness closed the same gap for
 * *parsing* with the corpus and HuBMAP suites; nothing closed it for *rendering*.
 *
 * These are the two templates the Angular 14 → 22 upgrade was being eyeballed against
 * by hand, in OpenView and the Metadata Editor, once per hop. A screenshot answers the
 * same question eight times without anyone looking.
 *
 * Between them they carry 21 distinct input types, one flat at 39 fields and one
 * nesting elements two deep across 68 multi-instance fields — which is the case a
 * generated fixture reaches least convincingly, and the one Material's MDC rewrite has
 * the most surface to disturb.
 *
 * Both pages are far taller than a screen, so the 1% `maxDiffPixelRatio` is a large
 * absolute budget here and a small localised change will not move it (the config
 * explains the measurement). That is the right trade for these two: what they are
 * watching for is a Material restyle or a layout collapse, both of which move far more
 * than 1%. Localised widget rendering is covered clipped, under `widgets, clipped`.
 *
 * They omit NIH Grant ID and DOI because the Template Designer cannot render those two
 * (TEMPLATE-DESIGNER-ROADMAP item 1), not because CEE cannot — it does, and
 * `08-authority` covers all seven authorities.
 */
test.describe('real templates', () => {
  const REAL = [
    ['17-real-flat', '39 fields, 21 input types, no nesting'],
    ['18-real-nested', 'elements nested two deep, 68 multi-instance fields'],
  ] as const;

  /**
   * Both templates carry a page break, and everything that distinguishes them is
   * behind it: the four nested elements, and the static rich text, image and video.
   * Page one of the two is very nearly the same document, so screenshotting only the
   * default view would have produced two baselines that differ in a section-break
   * position and nothing else — a gate that looks like two and is worth one.
   *
   * Nothing else in this suite pages a template. `05-static-paged` is captured on its
   * first page, and the static widgets behind its break are reached clipped instead.
   */
  const gotoPage = async (page: Page, n: number): Promise<void> => {
    await page
      .locator('.page-break-paginator-container mat-chip-option', { hasText: String(n) })
      .first()
      .click();
    await page.waitForTimeout(300);
  };

  for (const [fixture, description] of REAL) {
    test(`${fixture} — ${description}`, async ({ page }) => {
      const stray = await hermetic(page);
      await open(page, fixture);

      // The authority icons are CSS `background-image`s and the static image an `img`,
      // so they are fetched when the browser paints rather than before `__ceeReady`.
      // Without this the ROR icon lands in some runs and not others, and the baseline
      // records whichever happened — the difference is visible between two runs of the
      // same build.
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`${fixture}-page-1.png`, { fullPage: true });

      await gotoPage(page, 2);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${fixture}-page-2.png`, { fullPage: true });

      expectNoStrayHosts(stray);
    });
  }
});

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
 * One clipped screenshot per widget.
 *
 * The twelve full-page fixtures above are the wrong instrument for a widget-level
 * regression, and the footer rebrand proved it: a new logo, a new organisation
 * name and a new link changed 0.708% of the desktop page and 0.897% of the
 * narrow one, against a `maxDiffPixelRatio` of 1%, and `preset-chrome` reported
 * green. Nothing about that is specific to footers. A single widget is a small
 * fraction of any of these pages, so a widget that renders wrong after the
 * Material 15 MDC rewrite — the exact thing this suite exists to catch — can move
 * every pixel it owns and still come in under the page's budget.
 *
 * So each widget also gets a screenshot clipped to its own host element, with an
 * absolute pixel budget rather than an inherited ratio. Two consequences worth
 * having beyond the sensitivity: a failure names the widget instead of handing
 * over a full-page diff to search, and the baselines are small enough to review.
 *
 * Mutation-tested, because a claim like that is worth checking rather than
 * asserting. Shifting the section break's left padding from 10px to 14px — its
 * own text moves 4px, nothing else on the page moves, which is the shape of an
 * MDC restyle — changes 674 pixels. That is 0.059% of the desktop `05-static-paged`
 * page and 0.107% of the narrow one, so **both full-page baselines pass**, in both
 * projects, while both clipped section-break baselines fail. That is the whole
 * gap, in one measurement.
 *
 * `nth` is here because two widgets share a component: a text field and a
 * textarea are both `app-cedar-input-text`, and a single- and multi-select list
 * are both `app-cedar-input-select`. Each entry asserts its own element exists
 * before shooting, so a table that drifts out of step with a fixture fails
 * loudly rather than silently screenshotting the wrong element.
 *
 * Not listed, deliberately:
 *  - `app-time-picker` and `app-date-picker` are children of
 *    `app-cedar-input-datetime`, so its clip already contains them, and the time
 *    picker has its own tests below.
 *  - `app-cedar-multi-pager` already has `pager.png`, clipped for this reason.
 *  - `app-cedar-static-youtube` is covered semantically in
 *    `cross-browser-smoke.spec.ts`, where the iframe navigation is intercepted.
 *    A screenshot of third-party YouTube UI would depend on live network content
 *    and would not be a stable assertion about CEE.
 *  - `app-orcid-details` and `app-ror-details` only render after a term is
 *    selected, which needs a reachable authority service.
 */
const WIDGETS = [
  { name: 'input-text', selector: 'app-cedar-input-text', fixture: '01-input-types', nth: 0 },
  { name: 'input-textarea', selector: 'app-cedar-input-text', fixture: '01-input-types', nth: 1 },
  { name: 'input-numeric', selector: 'app-cedar-input-numeric', fixture: '01-input-types', nth: 0 },
  { name: 'input-email', selector: 'app-cedar-input-email', fixture: '01-input-types', nth: 0 },
  { name: 'input-phone', selector: 'app-cedar-input-phone', fixture: '01-input-types', nth: 0 },
  { name: 'input-link', selector: 'app-cedar-input-link', fixture: '01-input-types', nth: 0 },
  { name: 'input-datetime', selector: 'app-cedar-input-datetime', fixture: '01-input-types', nth: 0 },
  { name: 'input-checkbox', selector: 'app-cedar-input-checkbox', fixture: '02-choices', nth: 0 },
  { name: 'input-multiple-choice', selector: 'app-cedar-input-multiple-choice', fixture: '02-choices', nth: 0 },
  { name: 'input-select', selector: 'app-cedar-input-select', fixture: '02-choices', nth: 0 },
  { name: 'input-select-multi', selector: 'app-cedar-input-select', fixture: '02-choices', nth: 1 },
  { name: 'input-controlled', selector: 'app-cedar-input-controlled', fixture: '04-controlled-terms', nth: 0 },
  { name: 'input-orcid', selector: 'app-cedar-input-orcid', fixture: '08-authority', nth: 0 },
  { name: 'input-ror', selector: 'app-cedar-input-ror', fixture: '08-authority', nth: 0 },
  { name: 'input-pfas', selector: 'app-cedar-input-pfas', fixture: '08-authority', nth: 0 },
  { name: 'input-pmid', selector: 'app-cedar-input-pmid', fixture: '08-authority', nth: 0 },
  { name: 'input-rrid', selector: 'app-cedar-input-rrid', fixture: '08-authority', nth: 0 },
  { name: 'input-nih-grant', selector: 'app-cedar-input-nih-grant', fixture: '08-authority', nth: 0 },
  { name: 'input-doi', selector: 'app-cedar-input-doi', fixture: '08-authority', nth: 0 },
  {
    name: 'input-attribute-value',
    selector: 'app-cedar-input-attribute-value',
    fixture: '10-attribute-values',
    nth: 0,
  },
  { name: 'static-rich-text', selector: 'app-cedar-static-rich-text', fixture: '05-static-paged', nth: 0 },
  { name: 'static-section-break', selector: 'app-cedar-static-section-break', fixture: '05-static-paged', nth: 0 },
  { name: 'static-page-break', selector: 'app-cedar-static-page-break', fixture: '05-static-paged', nth: 0 },
  { name: 'static-image', selector: 'app-cedar-static-image', fixture: '05-static-paged', nth: 0 },
  { name: 'timezone-picker', selector: 'app-timezone-picker', fixture: '07-timezone', nth: 0 },
] as const;

/**
 * An absolute budget, not a ratio.
 *
 * A ratio is what let the footer through, and it fails worst exactly where it
 * matters most — the smaller the thing that broke, the more slack it gets. 120
 * pixels is a couple of glyphs' worth of rasterisation variance, and it is far
 * tighter than 1% of even the narrowest widget here (a 1142x61 field would get
 * 696). Within one machine the real figure is zero.
 *
 * This does override the config, rather than being softened by it: given both,
 * Playwright takes `Math.min` of the absolute budget and the ratio expanded
 * against the image's own area, so the stricter of the two governs.
 *
 * The trade-off, stated so it is not a surprise: these baselines are keyed to the
 * platform but not to the OS version, so an OS update that shifts font rendering
 * will fail them. Re-recording is the right response to that, and a full-page
 * baseline would very likely have gone with them anyway.
 */
const WIDGET_DIFF_BUDGET = 120;

test.describe('widgets, clipped', () => {
  for (const widget of WIDGETS) {
    test(`${widget.name} renders as recorded`, async ({ page }) => {
      await open(page, widget.fixture);

      const all = page.locator(widget.selector);
      expect(
        await all.count(),
        `${widget.fixture} has no ${widget.selector}[${widget.nth}] — the WIDGETS table is out of step with the fixture`,
      ).toBeGreaterThan(widget.nth);

      const element = all.nth(widget.nth);
      await expect(element).toBeVisible();
      await expect(element).toHaveScreenshot(`widget-${widget.name}.png`, {
        maxDiffPixels: WIDGET_DIFF_BUDGET,
      });
    });
  }
});

/**
 * The footer, asserted on its own rather than as part of `preset-chrome`.
 *
 * `preset-chrome` was the only baseline covering the footer, and it did not
 * catch the BMIR → Division of Computational Medicine rebrand: new logo, new
 * wordmark-free mark, new organisation name, new link. Measured against the
 * previous baselines, that whole change moved 0.708% of the desktop page and
 * 0.897% of the narrow one — under the 1% `maxDiffPixelRatio`, so both projects
 * reported green. Narrow cleared it by a tenth of a percentage point.
 *
 * The ratio is not the thing to fix; it is there to absorb cross-machine font
 * rasterisation, and tightening it globally trades one silent failure for a
 * noisy one. What was missing is that a *localised* change to a small region of
 * a tall page is exactly what a whole-page ratio cannot see. So:
 *
 *  - the mark is screenshotted clipped to the footer, where the same 1% is
 *    around a thousand pixels rather than sixteen thousand, and
 *  - the organisation's name and URL are asserted as text, because that is what
 *    they are. A brand is not a pixel region; it is a specific string, and it
 *    should fail on the string.
 */
/**
 * The version stamp, which the screenshots deliberately cannot see.
 *
 * screenshot.css hides it so the baselines survive a version bump, and that
 * removed the only thing watching it — a stamp that silently stopped rendering,
 * or rendered `undefined`, would now cost nothing. Asserted here instead, where
 * the check is about the text rather than about pixels, and where it can compare
 * against the manifest rather than against a hard-coded string that would have to
 * be edited at every hop.
 */
test.describe('the version stamp', () => {
  const declared = JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'))
    .version as string;

  test('is published on window and rendered in the header', async ({ page }) => {
    await open(page, '01-input-types', 'chrome');

    expect(
      await page.evaluate(() => (window as { cedarEmbeddableEditorVersion?: string }).cedarEmbeddableEditorVersion),
    ).toBe(declared);

    const stamp = page.locator('.cee-version');
    await expect(stamp).toHaveText(declared);
    // Hidden from the screenshot, not from the page: an embedder still sees it.
    await expect(stamp).toBeVisible();
  });
});

test.describe('the footer', () => {
  const ORGANISATION = 'Stanford Division of Computational Medicine';
  const HOME = 'https://computationalmedicine.stanford.edu';

  test('names the maintaining organisation and links to it', async ({ page }) => {
    await open(page, '01-input-types', 'chrome');
    const footer = page.locator('footer.main__footer');
    await expect(footer).toBeVisible();

    await expect(footer).toContainText(ORGANISATION);
    await expect(footer.locator('a').first()).toHaveAttribute('href', HOME);
    // The link is the logo's, and it is the only non-text route to the site, so
    // its accessible name has to carry the destination too.
    await expect(footer.locator('a').first()).toHaveAttribute('aria-label', HOME);
  });

  /**
   * The mark carries no text of its own.
   *
   * The old asset baked "BMIR" underneath the tree, so a rebrand that changed
   * only the strings would have left the previous name rendered in an image
   * where no text assertion could reach it. Cropping the wordmark off is what
   * makes the name above the single source of it — and this keeps it that way by
   * pinning the mark's aspect ratio to the crop.
   */
  test('shows the mark on its own', async ({ page }) => {
    await open(page, '01-input-types', 'chrome');
    const footer = page.locator('footer.main__footer');
    const logo = footer.locator('.division-logo');

    const box = await logo.boundingBox();
    expect(box, 'the footer logo has no box').toBeTruthy();
    // 224x194 cropped to the mark; `background-size: cover` would silently
    // distort it if the box drifted away from that ratio.
    expect(box!.width / box!.height).toBeCloseTo(224 / 194, 1);

    await expect(footer).toHaveScreenshot('footer.png');
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

    await expect(page.locator('mat-error'), 'a partly typed search term is not an invalid value').toHaveCount(0);
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

/**
 * CEE's own time picker.
 *
 * Written because `@angular-material-components/datetime-picker` peers Angular 16
 * and capped the upgrade, and because the obvious replacement supports no seconds
 * at all — while second-precision is the second most used granularity across both
 * artifact corpora, after `day`.
 *
 * Tested here rather than in the domain harness because it is a widget: what
 * matters is which boxes a granularity puts on screen and what a click on a
 * stepper stores. The arithmetic underneath has its own unit tests in
 * `harness/test/clock-time.spec.ts`.
 *
 * `09-temporal` is the fixture; before it existed the only temporal field under
 * test was minute-granularity, so the seconds boxes and the 12-hour face — the
 * entire reason for owning this — were rendered by nothing.
 */
test.describe('the time picker', () => {
  /**
   * Which picker belongs to which field, in document order.
   *
   * `year_only` and `day_only` are `xsd:date`, so they have no time half at all —
   * the six pickers are the six fields that do.
   */
  const PICKERS = [
    'hour_only',
    'to_the_minute',
    'to_the_second',
    'decimal_seconds',
    'twelve_hour',
    'twelve_hour_seconds',
  ];
  const pickerFor = (page: import('@playwright/test').Page, field: string) =>
    page.locator('.cee-time-picker').nth(PICKERS.indexOf(field));

  /** The instance CEE would hand a host page. */
  const storedValue = async (page: import('@playwright/test').Page, field: string): Promise<unknown> =>
    page.evaluate((name) => {
      const cee = document.querySelector('cedar-embeddable-editor') as unknown as Record<string, never>;
      const instance = cee['currentMetadata'] as Record<string, { '@value'?: unknown }>;
      return instance?.[name]?.['@value'];
    }, field);

  /**
   * Which boxes each granularity offers, asserted per field.
   *
   * This is the model-fidelity claim, and the reason CEE owns this component: a
   * field never shows precision it cannot store, and never hides precision it
   * can. `@ng-matero/extensions` would have failed the last two rows outright.
   */
  test.describe('shows exactly the units its granularity allows', () => {
    const cases: Array<[string, number, number]> = [
      // field, minute boxes, second boxes — every time field has exactly one hour
      ['hour_only', 0, 0],
      ['to_the_minute', 1, 0],
      ['to_the_second', 1, 1],
      ['decimal_seconds', 1, 1],
      ['twelve_hour', 1, 0],
      ['twelve_hour_seconds', 1, 1],
    ];

    for (const [field, minutes, seconds] of cases) {
      test(field, async ({ page }) => {
        await open(page, '09-temporal');
        const picker = pickerFor(page, field);

        await expect(picker.locator('input[aria-label="Hour"]'), 'hour').toHaveCount(1);
        await expect(picker.locator('input[aria-label="Minute"]'), 'minute').toHaveCount(minutes);
        await expect(picker.locator('input[aria-label="Second"]'), 'second').toHaveCount(seconds);
      });
    }

    test('a date-only field has no time picker at all', async ({ page }) => {
      await open(page, '09-temporal');
      await expect(page.locator('.cee-time-picker')).toHaveCount(PICKERS.length);
    });
  });

  test('the 12-hour fields show a meridian control and the others do not', async ({ page }) => {
    await open(page, '09-temporal');
    await expect(page.locator('.cee-time-meridian'), 'only the two 12h fields').toHaveCount(2);
    await expect(pickerFor(page, 'twelve_hour').locator('.cee-time-meridian')).toHaveText(/AM|PM/);
    await expect(pickerFor(page, 'to_the_minute').locator('.cee-time-meridian')).toHaveCount(0);
  });

  test('typing an hour stores it', async ({ page }) => {
    await open(page, '09-temporal');
    const hour = pickerFor(page, 'to_the_minute').locator('input[aria-label="Hour"]');
    await hour.fill('14');
    await page.waitForTimeout(300);

    expect(String(await storedValue(page, '_to_the_minute'))).toContain('14:');
  });

  /**
   * Wrapping rather than clamping. The browser's native stepper clamps at max,
   * which is why the buttons exist.
   */
  test('stepping past the end of an hour wraps to the start', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_minute');
    const hour = picker.locator('input[aria-label="Hour"]');
    await hour.fill('23');
    await page.waitForTimeout(200);

    // The increment button sits above its box.
    await picker.locator('button[aria-label="Increment hour"]').click();
    await page.waitForTimeout(300);

    // Zero-padded, as a clock reads and as the dependency this replaced did.
    await expect(hour).toHaveValue('00');
    expect(String(await storedValue(page, '_to_the_minute'))).toContain('00:');
  });

  test('stepping below zero wraps to the end', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_minute');
    const minute = picker.locator('input[aria-label="Minute"]');
    await minute.fill('0');
    await page.waitForTimeout(200);
    await picker.locator('button[aria-label="Decrement minute"]').click();
    await page.waitForTimeout(300);

    await expect(minute).toHaveValue('59');
  });

  test('seconds reach the stored value', async ({ page }) => {
    await open(page, '09-temporal');
    const second = pickerFor(page, 'to_the_second').locator('input[aria-label="Second"]');
    await second.fill('42');
    await page.waitForTimeout(300);

    expect(String(await storedValue(page, '_to_the_second'))).toContain(':42');
  });

  /**
   * The invariant worth guarding above all others: CEDAR stores a 24-hour clock
   * whatever the field displays. A 12-hour field showing 2 PM must store 14.
   */
  test('a 12-hour field stores 24-hour time', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'twelve_hour');
    const hour = picker.locator('input[aria-label="Hour"]');
    const meridian = picker.locator('.cee-time-meridian');

    await hour.fill('2');
    await page.waitForTimeout(200);
    if ((await meridian.textContent())?.trim() === 'AM') {
      await meridian.click();
      await page.waitForTimeout(200);
    }
    await expect(meridian).toHaveText('PM');
    await page.waitForTimeout(300);

    const stored = String(await storedValue(page, '_twelve_hour'));
    expect(stored, `2 PM must store as 14, got ${stored}`).toContain('14:');
  });

  test('a 12-hour field stores midnight as 00, not 12', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'twelve_hour');
    const hour = picker.locator('input[aria-label="Hour"]');
    const meridian = picker.locator('.cee-time-meridian');

    await hour.fill('12');
    await page.waitForTimeout(200);
    if ((await meridian.textContent())?.trim() === 'PM') {
      await meridian.click();
      await page.waitForTimeout(200);
    }
    await expect(meridian).toHaveText('AM');
    await page.waitForTimeout(300);

    expect(String(await storedValue(page, '_twelve_hour'))).toContain('00:');
  });

  /**
   * Noon, which is the case a 12-hour clock actually gets wrong.
   *
   * Added because mutation-testing the conversion exposed the gap: breaking
   * `12 PM → 12` failed the unit tests and passed all fifteen browser tests,
   * because the cases here were 2 PM and 12 AM and neither exercises it. 2 PM
   * survives most plausible off-by-twelve bugs; noon survives none of them.
   */
  test('a 12-hour field stores noon as 12', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'twelve_hour');
    const hour = picker.locator('input[aria-label="Hour"]');
    const meridian = picker.locator('.cee-time-meridian');

    await hour.fill('12');
    await page.waitForTimeout(200);
    if ((await meridian.textContent())?.trim() === 'AM') {
      await meridian.click();
      await page.waitForTimeout(200);
    }
    await expect(meridian).toHaveText('PM');
    await page.waitForTimeout(300);

    const stored = String(await storedValue(page, '_twelve_hour'));
    expect(stored, `noon must store as 12, got ${stored}`).toContain('12:');
  });

  /**
   * The colons line up with the digits.
   *
   * Guarded rather than eyeballed because the CSS that achieves it is matched to
   * Material's own geometry — `mat-form-field` reserves space beneath its input,
   * so the digits' centre is well above the control's — and the 14 → 15 MDC
   * migration changes that. A screenshot baseline would catch it too, but only as
   * "these pixels differ"; this says what is wrong.
   *
   * Two cleverer approaches failed first: a chrome-less form field holding the
   * colon collapsed its input to zero width, correctly positioned and entirely
   * invisible; a `matSuffix` aligned perfectly but put the colon inside the
   * preceding box.
   */
  test('the colons sit level with the digits', async ({ page }) => {
    await open(page, '09-temporal');

    const offsets = await page.evaluate(() => {
      const picker = document
        .querySelector('cedar-embeddable-editor')!
        .shadowRoot!.querySelectorAll('.cee-time-picker')[2]; // to_the_second
      const digit = picker.querySelector('input[aria-label="Hour"]')!.getBoundingClientRect();
      const digitCentre = digit.top + digit.height / 2;
      return Array.from(picker.querySelectorAll('.cee-time-separator')).map((sep) => {
        const box = sep.getBoundingClientRect();
        return { off: box.top + box.height / 2 - digitCentre, width: box.width };
      });
    });

    expect(offsets, 'two colons on a to-the-second field').toHaveLength(2);
    for (const { off, width } of offsets) {
      expect(Math.abs(off), `colon is ${off.toFixed(1)}px off the digit centre`).toBeLessThan(3);
      // A zero-width colon is positioned perfectly and invisible, which is
      // exactly the failure one of the earlier attempts produced.
      expect(width, 'the colon has to actually be visible').toBeGreaterThan(2);
    }
  });

  test('read-only mode shows the time as text, not as boxes', async ({ page }) => {
    await open(page, '09-temporal', 'readonly');
    expect(await page.locator('input[aria-label="Hour"]').count()).toBe(0);
    expect(await page.locator('.cee-time-picker-readonly').count()).toBeGreaterThan(0);
  });
});

/**
 * Two behaviours ported here from Angular component specs, which are now deleted.
 *
 * Of forty legacy specs, thirty-eight asserted `expect(component).toBeTruthy()` and
 * went. Two looked like real coverage. The domain harness deliberately loads no
 * Angular, so a component method guarded by a template `*ngIf` is beyond it by
 * construction — which is what both of these were — so they came here.
 *
 * Browser tests rather than harness reproductions, because both original specs
 * drove their methods directly with `jasmine.createSpyObj`, asserting that a method
 * returned what it returned. Asserting through what a user would see instead means
 * a test cannot pass while the feature is broken in a way the mocks did not model.
 *
 * Both ports are mutation-verified, and neither was on the first attempt. The
 * render-decision test kills a mutant that makes the content always render. The two
 * choice tests killed nothing until the mechanism behind them was traced — every
 * single-line mutant was masked by a redundant second path — and the mutants that do
 * kill them are named in their comment. Mutation testing is the difference between a
 * port and a hope; on both counts here it changed what got deleted and when.
 */
test.describe('ported from the deleted component specs', () => {
  /**
   * Where a choice field's value comes from, traced — because these two tests
   * initially killed no mutant, and the reason turned out to be worth writing down.
   *
   * What matters to a user: a template default fills an empty choice field, and a
   * value the document already holds is **not** overwritten by that default. Getting
   * the second wrong is data loss that looks like a working form, because the field
   * still shows *a* value, just not theirs.
   *
   * The actual sequence, from instrumenting the paths and reading the console:
   *
   *  1. `DataObjectBuilderHandler` seeds `selectedByDefault` into the instance. The
   *     default is applied by the **data layer**, before any widget exists.
   *  2. The widget's `populateItemsOnLoad` then reads the data object, finds the
   *     seeded value already there, takes its "existing `@value`" branch and sets the
   *     control. Its own default-applying loop is never reached in this path.
   *  3. An injected instance arrives **after** the widget has initialised —
   *     `populateItemsOnLoad` runs once and sees the seeded default, never the
   *     injected value. What puts the injected value on screen is
   *     `ActiveComponentRegistryService.updateViewToModel`, which pushes the model
   *     into the widget through `setCurrentValue`.
   *
   * So every mechanism here is doubly covered, and that is why single mutants all
   * survived. Disabling `populateItemsOnLoad`'s guard is an *equivalent* mutant: it
   * falls through to the default loop, which applies the same value the guard would
   * have set, because the data layer had already seeded it. Disabling that loop is
   * masked by the seeding; disabling the seeding is masked by the loop.
   *
   * **The mutants that do kill these tests**, both confirmed by rebuilding and
   * running — quote them to anyone who suspects these assertions of being decorative:
   *
   *   - `default fills empty`: disable the seeding in `DataObjectBuilderHandler`
   *     **and** the default loop in `populateItemsOnLoad`. Either alone is masked.
   *   - `injected value is not overwritten`: disable the literal push in
   *     `ActiveComponentRegistryService.updateViewToModel`.
   *
   * Which is what retired `cedar-input-multiple-choice.component.spec.ts`. It
   * asserted that `populateItemsOnLoad` did not call a `jasmine.createSpyObj` mock
   * with the default — a claim about a method whose every branch is redundant with
   * something else. These assert the outcome instead, through the real
   * `instanceObject` entry point.
   */
  test('a template default fills an empty choice field', async ({ page }) => {
    await open(page, '11-choice-default');

    const checked = page.getByRole('radio', { checked: true });
    await expect(checked).toHaveCount(1);
    await expect(checked).toHaveAccessibleName('Limited');
  });

  test('an injected value is not overwritten by the template default', async ({ page }) => {
    await open(page, '11-choice-default', undefined, '11-choice-default-instance');

    const checked = page.getByRole('radio', { checked: true });
    await expect(checked, 'exactly one option selected').toHaveCount(1);
    await expect(checked, "the instance says Private; the template's default is Limited").toHaveAccessibleName(
      'Private',
    );
  });

  /**
   * From `cedar-component-renderer.component.spec.ts`, whose three cases covered
   * every branch of `shouldRenderContentOfNonIterable`.
   *
   * `isMultiPage()` is `!(checkbox || list)`. So a list field is multiple but not
   * paged and always shows its content, while a paged field with no instances shows
   * none — there is no occurrence to show, and its pager says so instead. The
   * fixture puts all three cases on one page in this order, and the observable
   * consequence is whether a `mat-card-content` exists inside each field's card.
   */
  test('a multi field renders its content only when it has something to show', async ({ page }) => {
    await open(page, '12-render-decision');

    const cards = page.locator('mat-card.non-iterable-component');
    await expect(cards, 'fixture should render three fields').toHaveCount(3);

    const expected = [
      ['list_no_values', 1, 'a list field is multi but not paged, so it always shows its content'],
      ['paged_no_instances', 0, 'paged with no instances: nothing to show, so no content area'],
      ['paged_one_instance', 1, 'paged with one instance: content shown'],
    ] as const;

    for (const [name, count, why] of expected) {
      const card = cards.nth(expected.findIndex((e) => e[0] === name));
      await expect(card.locator('app-cedar-component-header'), `card order changed: expected ${name}`).toContainText(
        name,
      );
      await expect(card.locator('mat-card-content'), `${name}: ${why}`).toHaveCount(count);
    }
  });
});

/**
 * Every route a value can arrive by, now that no widget populates itself.
 *
 * `CedarInputMultipleChoiceComponent.populateItemsOnLoad` is gone. It read the data
 * object in `ngOnInit` and set its control from it, which was redundant: every load
 * path — `templateObject`, `instanceObject`, `templateAndInstanceObject`, and the
 * sample-template loader, which assembles the combined object and funnels into it —
 * ends at `initDataFromInstance` → `renderInstance`, and that sweeps
 * `ActiveComponentRegistryService.updateViewToModel` across every child. One
 * mechanism, uniformly applied.
 *
 * Deleting it was checked path by path first, comparing both the checked radio and
 * `currentMetadata` before and after: identical on all six cases below. These tests
 * hold that, so the redundancy cannot quietly stop being redundant.
 *
 * The paged cases are the ones that earn their place. A widget created *after* the
 * initial sweep — by paging to another occurrence — was never part of it, so if
 * anything still depended on a widget populating itself in `ngOnInit`, reading the
 * second occurrence is where it would show. Its two occurrences hold `Public` and
 * `Private`, neither of them the template's default of `Limited`, so a default
 * leaking through is visible rather than coincidentally right.
 *
 * Note the sibling `CedarInputSelectComponent.populateItemsOnLoad` survives and must:
 * same name, unrelated job — it fills the dropdown's *option list*, not a value.
 */
test.describe('a choice value reaches the widget by every load path', () => {
  const checkedRadio = (page: import('@playwright/test').Page) => page.getByRole('radio', { checked: true });

  test('templateObject alone applies the template default', async ({ page }) => {
    await open(page, '11-choice-default');
    await expect(checkedRadio(page)).toHaveCount(1);
    await expect(checkedRadio(page)).toHaveAccessibleName('Limited');
  });

  test('the combined templateAndInstanceObject input keeps the instance value', async ({ page }) => {
    await open(page, '11-choice-default', undefined, '11-choice-default-instance', 'combined');
    await expect(checkedRadio(page), 'exactly one option selected').toHaveCount(1);
    await expect(checkedRadio(page), 'the combined input takes a different branch in the editor').toHaveAccessibleName(
      'Private',
    );
  });

  for (const mode of ['separate', 'combined'] as const) {
    test(`each occurrence shows its own value (${mode} inputs)`, async ({ page }) => {
      await open(page, '13-paged-choice', undefined, '13-paged-choice-instance', mode);

      await expect(checkedRadio(page), 'first occurrence').toHaveAccessibleName('Public');

      const chips = page.locator('app-cedar-multi-pager mat-chip-option');
      await expect(chips, 'the fixture declares two occurrences').toHaveCount(2);
      await chips.nth(1).click();
      await page.waitForTimeout(400);

      // The widget for this occurrence was not part of the initial sweep, so this is
      // the assertion that would fail if anything still needed a widget to populate
      // itself on init.
      await expect(checkedRadio(page), 'second occurrence, after paging').toHaveAccessibleName('Private');
    });
  }
});

/**
 * Instance values are sanitized; template-authored rich text is not.
 *
 * `TrustHtmlPipe` (`keepHtml`) is `bypassSecurityTrustHtml`, and it used to be applied
 * to three things: the static rich-text field's body, a text field's own value when
 * `isRichText`, and pager labels built from values. The first is content a *template
 * author* wrote. The other two are **instance data**, arriving with whatever document
 * the host page loaded — and CEE is embedded in someone else's page, so trusting them
 * handed an instance author script execution in that origin.
 *
 * `isRichText` is set by `checkHTMLContent`, which asks whether the *value* looks like
 * HTML, from `onReadOnlyModeChange(true)`. So the trigger was the data and the gate was
 * read-only mode: a documented viewer mode, no exotic config needed. Verified before
 * the fix — an inert probe element was parsed into live DOM.
 *
 * The two instance sinks now use `safeHtml`, which sanitizes rather than bypasses. The
 * static rich-text field keeps `keepHtml`, deliberately: a template author is already
 * trusted with the form's structure, and stripping their formatting would break a
 * documented feature to no benefit.
 *
 * The probe value carries both halves, so one assertion distinguishes all three possible
 * behaviours. `<b>` is safe formatting and survives sanitization — its presence proves
 * the field was not simply escaped wholesale, which would have been a regression dressed
 * up as a fix. The `onerror` handler is what sanitization removes, and it sets a window
 * flag and nothing else.
 */
test.describe('markup in an instance value', () => {
  test('is escaped, not rendered, while the field is editable', async ({ page }) => {
    await open(page, '01-input-types', undefined, '14-markup-in-a-value');

    expect(await page.locator('[data-safe-markup]').count(), 'an editable field shows text').toBe(0);
    const asText = await page.evaluate(() =>
      Array.from(
        document.querySelector('cedar-embeddable-editor')!.shadowRoot!.querySelectorAll('input,textarea'),
      ).some((e) => (e as HTMLInputElement).value.includes('<b data-safe-markup')),
    );
    expect(asText, 'the field should hold the markup verbatim as its value').toBe(true);
  });

  test('is sanitized, not trusted, when read-only renders it as HTML', async ({ page }) => {
    const handlerRan: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('__handlerRan')) handlerRan.push(m.text());
    });

    await open(page, '01-input-types', 'readonly', '14-markup-in-a-value');

    // Safe formatting survives — this is still a rich-text render, not an escape.
    await expect(page.locator('b'), 'sanitizing must not strip safe formatting from a rich-text value').not.toHaveCount(
      0,
    );

    // The handler does not.
    const ran = await page.evaluate(() => (window as any).__handlerRan === true);
    expect(ran, 'an event handler from an instance value executed').toBe(false);

    const handlers = await page.evaluate(
      () =>
        Array.from(document.querySelector('cedar-embeddable-editor')!.shadowRoot!.querySelectorAll('*')).filter((e) =>
          e.hasAttribute('onerror'),
        ).length,
    );
    expect(handlers, 'an onerror attribute survived sanitization').toBe(0);
    expect(handlerRan, 'the handler produced console output, so it ran').toEqual([]);
  });
});

/**
 * Each authority field asks its own endpoint.
 *
 * `ExternalAuthorityLookupService` replaced seven near-identical services with one,
 * which is a clear win and moved a per-field decision into a table: each descriptor
 * names the config keys its endpoints come from. The table had no test. A descriptor
 * naming another authority's key, or a widget wired to the wrong descriptor, would
 * send a field to the wrong service — and because every one of them answers the same
 * shape, the field would keep working against something live and fail only in ways
 * nobody would attribute to a config key.
 *
 * The `authority` preset gives each of the seven a unique unroutable URL, and this
 * intercepts the requests, so the assertion is on what CEE *asked for*. That covers
 * the descriptor table, the wiring, and the query parameter, without a live service
 * and without leaving the machine.
 *
 * Requests are fulfilled with an empty result rather than aborted: aborting surfaces
 * as a lookup error in the widget, which is a different behaviour from a search that
 * found nothing, and this test is about the request rather than the response.
 */
test.describe('external authority endpoints', () => {
  const FIELDS = [
    { label: 'contributor_orcid', authority: 'orcid' },
    { label: 'institution_ror', authority: 'ror' },
    { label: 'chemical_pfas', authority: 'pfas' },
    { label: 'citation_pmid', authority: 'pmid' },
    { label: 'resource_rrid', authority: 'rrid' },
    { label: 'award_nih', authority: 'nihGrant' },
    { label: 'dataset_doi', authority: 'doi' },
  ] as const;

  for (const { label, authority } of FIELDS) {
    test(`${label} searches the ${authority} endpoint`, async ({ page }) => {
      const asked: string[] = [];
      await page.route('**/authority/**', async (route) => {
        asked.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ found: 0, results: {} }),
        });
      });

      await open(page, '08-authority', 'authority');

      const field = page.locator(`input[aria-label="${label}"]`);
      await expect(field, `no field labelled ${label} in 08-authority`).toBeVisible();
      // Typed rather than filled: the widget searches on input, and `fill` can land as
      // a single event that the debounce swallows.
      await field.pressSequentially('probe', { delay: 40 });
      await passDebounceWindow(page);

      // The service staggers requests by up to 500ms — transcribed from the ORCID
      // service it replaced, where it was there to avoid throttling — so this has to
      // outwait that rather than assume a prompt request.
      await expect(async () => {
        expect(asked.length, `${label} issued no search request`).toBeGreaterThan(0);
      }).toPass({ timeout: 5000 });

      const wrong = asked.filter((u) => !u.includes(`/authority/${authority}/`));
      expect(wrong, `${label} asked another authority's endpoint`).toEqual([]);
      expect(
        asked.some((u) => u.includes('q=probe')),
        'the query is not in the request',
      ).toBe(true);
    });
  }

  test('a returned authority term can be selected and reaches the host metadata', async ({ page }) => {
    const id = 'https://comptox.epa.gov/dashboard/chemical/details/DTXSID00000001';
    const label = 'Deterministic PFAS result';
    await page.route('**/authority/pfas/search**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ found: true, results: { [id]: { name: label } } }),
      });
    });

    await open(page, '08-authority', 'authority');
    const field = page.locator('input[aria-label="chemical_pfas"]');
    await field.pressSequentially('deterministic', { delay: 40 });
    await passDebounceWindow(page);
    const option = page.locator('mat-option').filter({ hasText: label });
    await expect(option, 'the authority response did not become a selectable option').toBeVisible({ timeout: 5000 });
    await option.click();

    await expect(field).toHaveValue(`${label} - ${id}`);
    const metadata = await page.evaluate(
      () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
    );
    expect(JSON.stringify(metadata), 'the selected authority term did not reach currentMetadata').toContain(id);
    expect(JSON.stringify(metadata)).toContain(label);
  });
});

test.describe('controlled terminology selection', () => {
  test('a returned term can be selected and reaches the host metadata', async ({ page }) => {
    const id = 'http://purl.obolibrary.org/obo/NCBITaxon_9606';
    const label = 'Homo sapiens';
    await page.route('http://127.0.0.1:9/unused', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ collection: [{ id, '@id': id, prefLabel: label }] }),
      });
    });

    await open(page, '04-controlled-terms');
    const field = page.locator('input[aria-label="organism"]');
    await field.pressSequentially('Homo', { delay: 40 });
    await passDebounceWindow(page);
    const option = page.locator('mat-option').filter({ hasText: label });
    await expect(option, 'the terminology response did not become a selectable option').toBeVisible({ timeout: 6000 });
    await option.click();

    await expect(field).toHaveValue(label);
    const metadata = await page.evaluate(
      () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
    );
    expect(JSON.stringify(metadata), 'the selected controlled term did not reach currentMetadata').toContain(id);
    expect(JSON.stringify(metadata)).toContain(label);
  });
});

/**
 * The two output getters a host page reads.
 *
 * `currentMetadata` and `currentMetadataYaml` are how an embedding page gets the
 * edited document back out — the whole point of the component from the host's side.
 * The JSON one is exercised indirectly all over the domain harness; the YAML one was
 * touched by nothing, in either suite, despite being a separate serializer
 * (`InstanceSerializer.toYaml`) with its own failure modes.
 *
 * Asserted without a YAML parser, which `visual/` does not have and which is not worth
 * a dependency: the checks are that the two outputs agree about the document. Same
 * field values, same template IRI, and none of the shapes a broken serializer actually
 * produces — an empty string, `undefined`, or `[object Object]` where a nested node
 * should be. A structural check on agreement catches a serializer that has stopped
 * working; it does not need to re-verify YAML grammar the library already tests.
 */
test.describe('what a host page reads back', () => {
  const read = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const cee = document.querySelector('cedar-embeddable-editor') as any;
      return { json: JSON.stringify(cee.currentMetadata), yaml: cee.currentMetadataYaml };
    });

  test('both outputs describe the instance that was injected', async ({ page }) => {
    await open(page, '11-choice-default', undefined, '11-choice-default-instance');
    const { json, yaml } = await read(page);

    expect(json, 'currentMetadata should carry the injected value').toContain('Private');
    expect(typeof yaml, 'currentMetadataYaml should be a string').toBe('string');
    expect(yaml.length, 'currentMetadataYaml is empty').toBeGreaterThan(0);
    expect(yaml, 'the YAML output should carry the same value as the JSON').toContain('Private');
    // The two failure shapes a broken serializer produces rather than throwing.
    expect(yaml).not.toContain('[object Object]');
    expect(yaml).not.toContain('undefined');
  });

  test('the YAML output keeps a nested multi-instance structure', async ({ page }) => {
    await open(page, '13-paged-choice', undefined, '13-paged-choice-instance');
    const { json, yaml } = await read(page);

    // Both occurrences, so a serializer that flattens or drops repeats is visible.
    for (const value of ['Public', 'Private']) {
      expect(json, `JSON output lost ${value}`).toContain(value);
      expect(yaml, `YAML output lost ${value}`).toContain(value);
    }
    expect(yaml).not.toContain('[object Object]');
  });

  test('an edit reaches both outputs', async ({ page }) => {
    await open(page, '01-input-types');
    await page.locator('input[aria-label="text"]').fill('typed into the form');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);

    const { json, yaml } = await read(page);
    expect(json, 'an edit did not reach currentMetadata').toContain('typed into the form');
    expect(yaml, 'an edit did not reach currentMetadataYaml').toContain('typed into the form');
  });

  test('currentMetadataSerialized follows the configured format with real content', async ({ page }) => {
    await open(page, '11-choice-default', undefined, '11-choice-default-instance');
    const json = await page.evaluate(
      () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadataSerialized,
    );
    expect(typeof json).toBe('object');
    expect(JSON.stringify(json)).toContain('Private');

    await open(page, '11-choice-default', undefined, '11-choice-default-instance', undefined, '&s=yaml');
    const yaml = await page.evaluate(
      () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadataSerialized,
    );
    expect(typeof yaml).toBe('string');
    expect(yaml).toContain('Private');
  });

  test('dataQualityReport follows an invalid value and its correction', async ({ page }) => {
    await open(page, '06-validation');
    const email = page.locator('input[aria-label="an_email"]');
    await email.fill('not-an-email');
    await email.blur();

    const readProblems = () =>
      page.evaluate(() => (document.querySelector('cedar-embeddable-editor') as any).dataQualityReport.problems);
    await expect(async () => {
      expect((await readProblems()).some((problem: any) => problem.code === 'email')).toBe(true);
    }).toPass();

    await email.fill('valid@example.org');
    await email.blur();
    await expect(async () => {
      expect((await readProblems()).some((problem: any) => problem.code === 'email')).toBe(false);
    }).toPass();
  });
});

test.describe('host input timing', () => {
  test('template-first separate inputs keep the supplied instance value', async ({ page }) => {
    await open(page, '11-choice-default', undefined, '11-choice-default-instance', 'template-first');
    await expect(page.getByRole('radio', { checked: true })).toHaveAccessibleName('Private');
    const metadata = await page.evaluate(
      () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
    );
    expect(JSON.stringify(metadata)).toContain('Private');
  });

  test('replacing an instance updates both the rendered widget and host output', async ({ page }) => {
    await open(page, '11-choice-default', undefined, '11-choice-default-instance');
    await page.evaluate(() => {
      const cee = document.querySelector('cedar-embeddable-editor') as any;
      const replacement = structuredClone(cee.currentMetadata);
      replacement._access['@value'] = 'Public';
      cee.instanceObject = replacement;
    });

    await expect(page.getByRole('radio', { checked: true })).toHaveAccessibleName('Public');
    await expect(async () => {
      const metadata = await page.evaluate(
        () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
      );
      expect(metadata._access['@value']).toBe('Public');
    }).toPass();
  });
});

test.describe('host change notifications', () => {
  const recordChanges = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      (window as any).__ceeChanges = [];
      document.querySelector('cedar-embeddable-editor').addEventListener('change', (event: CustomEvent) => {
        (window as any).__ceeChanges.push(event.detail ?? null);
      });
    });

  test('a field edit bubbles a change event and updates currentMetadata', async ({ page }) => {
    await open(page, '01-input-types');
    await recordChanges(page);
    const field = page.locator('input[aria-label="text"]');
    await field.fill('host-visible edit');
    await field.blur();

    await expect(async () => {
      expect(await page.evaluate(() => (window as any).__ceeChanges.length)).toBeGreaterThan(0);
    }).toPass();
    const metadata = await page.evaluate(
      () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
    );
    expect(JSON.stringify(metadata)).toContain('host-visible edit');
  });

  test('multi-instance add, copy and delete report their operation and obey maxItems', async ({ page }) => {
    await open(page, '13-paged-choice', undefined, '13-paged-choice-instance');
    await recordChanges(page);
    const pager = page.locator('app-cedar-multi-pager').first();
    // `button[mat-icon-button]` rather than every button in the pager: an MDC chip
    // renders its own button inside itself, so a bare `button` locator picks up one
    // per occurrence and the action buttons stop being nth(0..2).
    const add = pager.locator('button[mat-icon-button]').nth(0);
    const copy = pager.locator('button[mat-icon-button]').nth(1);
    const remove = pager.locator('button[mat-icon-button]').nth(2);
    const count = () =>
      page.evaluate(() => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata._record.length);
    const messages = () =>
      page.evaluate(() => (window as any).__ceeChanges.map((detail: any) => detail?.message).filter(Boolean));

    expect(await count()).toBe(2);
    await add.click();
    await expect(async () => expect(await count()).toBe(3)).toPass();
    await expect(async () => expect(await messages()).toContain('multiInstanceAdded')).toPass();

    await copy.click();
    await expect(async () => expect(await count()).toBe(4)).toPass();
    await expect(async () => expect(await messages()).toContain('multiInstanceCopied')).toPass();
    await expect(add, 'add must disable at maxItems').toBeDisabled();
    await expect(copy, 'copy must disable at maxItems').toBeDisabled();

    await remove.click();
    await expect(async () => expect(await count()).toBe(3)).toPass();
    await expect(async () => expect(await messages()).toContain('multiInstanceDeleted')).toPass();
    await expect(add).toBeEnabled();
  });
});

/**
 * Every boolean config flag does something.
 *
 * CEE takes 31 config keys and two thirds of them appeared in no test. Breadth is the
 * point rather than depth: the failure this catches is a key that is silently ignored,
 * which is indistinguishable from a working one until someone relies on it. That is
 * not hypothetical — `eventHandler` is a documented input whose value is stored in
 * `MessageHandlerService` and never read, so a host page passing one gets silence, and
 * nothing said so.
 *
 * So each flag is loaded off and on, and the rendered DOM has to differ. A weak
 * assertion deliberately: it cannot say a flag does the *right* thing, and pinning
 * each one's exact output would be a large baseline for a small return. It can say the
 * flag is wired to something, which is the question that was unanswered for nineteen
 * of them.
 *
 * `expanded*` flags are paired with the panel they expand, since expanding a panel that
 * is not shown changes nothing and would read as a dead flag.
 */
test.describe('config flags are wired to something', () => {
  const FLAGS: ReadonlyArray<{ flag: string; withFlags?: string[]; fixture?: string }> = [
    { flag: 'showHeader' },
    { flag: 'showFooter' },
    { flag: 'showPreferencesMenu' },
    { flag: 'showSampleTemplateLinks' },
    { flag: 'showTemplateRenderingRepresentation' },
    { flag: 'showInstanceDataCore' },
    { flag: 'showInstanceDataFull' },
    { flag: 'showTemplateSourceData' },
    { flag: 'showDataQualityReport' },
    { flag: 'showMultiInstanceInfo', fixture: '03-nested-multi' },
    // Expanding a panel only shows when the panel itself is shown.
    { flag: 'expandedInstanceDataCore', withFlags: ['showInstanceDataCore'] },
    { flag: 'expandedInstanceDataFull', withFlags: ['showInstanceDataFull'] },
    { flag: 'expandedTemplateSourceData', withFlags: ['showTemplateSourceData'] },
    { flag: 'expandedDataQualityReport', withFlags: ['showDataQualityReport'] },
    { flag: 'expandedTemplateRenderingRepresentation', withFlags: ['showTemplateRenderingRepresentation'] },
    { flag: 'expandedSampleTemplateLinks', withFlags: ['showSampleTemplateLinks'] },
    { flag: 'expandedMultiInstanceInfo', withFlags: ['showMultiInstanceInfo'], fixture: '03-nested-multi' },
  ];

  /**
   * Strip the identifiers Angular generates, which say nothing about a config key.
   *
   * Comparing raw innerHTML made this whole sweep pass for the wrong reason on
   * Angular 14 and 15: the style-encapsulation prefix was random per bootstrap, so
   * `_nghost-hom-c24` and `_nghost-uwy-c24` made any two page loads "differ"
   * whether or not the flag did anything. Three flags were tested that way and
   * changed nothing at all. Angular 16 made the prefixes deterministic and the free
   * pass vanished, which is how they were finally caught.
   *
   * Normalising here is what makes the assertion mean what it says. A comparison
   * that can be satisfied by a random string is not a comparison.
   */
  const normaliseAngularIds = (html: string): string =>
    html
      .replace(/_nghost-[\w-]+/g, '_nghost')
      .replace(/_ngcontent-[\w-]+/g, '_ngcontent')
      .replace(/ng-tns-c\d+-\d+/g, 'ng-tns');

  const domOf = async (page: import('@playwright/test').Page, fixture: string, flags: string[], off: string[] = []) => {
    await page.clock.setFixedTime(FROZEN);
    const f = flags.length ? `&f=${flags.join(',')}` : '';
    const n = off.length ? `&n=${off.join(',')}` : '';
    await page.goto(`/host.html?t=${fixture}${f}${n}&b=${BUNDLE_VERSION}`);
    await page.waitForFunction(() => (window as any).__ceeReady === true || (window as any).__ceeError, null, {
      timeout: 20_000,
    });
    expect(await page.evaluate(() => (window as any).__ceeError)).toBeFalsy();
    await page.waitForTimeout(300);
    const html = await page.evaluate(
      () => (document.querySelector('cedar-embeddable-editor') as HTMLElement).shadowRoot?.innerHTML ?? '',
    );
    return normaliseAngularIds(html);
  };

  /**
   * Wired, but to something no fixture in the corpus produces.
   *
   * Each of these gates on a second condition as well as the flag, and the corpus
   * never satisfies it — so the flag cannot change anything here whatever it is set
   * to. They were "passing" until Angular 16 made ids deterministic, at which point
   * it became clear they were comparing a page with itself.
   *
   * `fixme` rather than deletion or a silent skip: the run reports them, so the gap
   * stays visible until a fixture reaches the condition. Adding one is tracked
   * separately; both conditions are named here so whoever builds it knows the shape.
   */
  const UNREACHABLE = new Map([
    [
      'showStaticText',
      'gates on `linkedStaticFieldComponent`, which template-representation.factory only ' +
        'sets for a lone static component immediately preceding a field or element. Every ' +
        'static run in the corpus is a pair, so nothing is ever linked.',
    ],
    [
      'showAllMultiInstanceValues',
      'gates on `multiInstanceValue`, and getMultiInstanceDataValueInfo returns "" unless ' +
        'the paged component is a *field* holding values. The corpus pages elements, so the ' +
        'summary is always empty. Needs a multi-instance field plus an instance to fill it.',
    ],
  ]);

  for (const [flag, why] of UNREACHABLE) {
    test.fixme(`${flag} changes what renders`, () => {
      throw new Error(`no fixture reaches this flag: ${why}`);
    });
  }

  for (const { flag, withFlags = [], fixture = '01-input-types' } of FLAGS) {
    test(`${flag} changes what renders`, async ({ page }) => {
      // Both ends stated explicitly. Relying on the flag's absence as its off-state
      // is only correct for keys that default to false, and three here do not.
      const off = await domOf(page, fixture, withFlags, [flag]);
      const on = await domOf(page, fixture, [...withFlags, flag]);

      expect(on === off, `turning on ${flag} rendered byte-identical DOM — the key is probably ignored`).toBe(false);
    });
  }
});

/**
 * Each date picker formats with its own granularity.
 *
 * `DateTimeService` is `providedIn: 'root'` — one instance shared by every date picker
 * on the page — and each `DatePickerComponent.ngOnInit` writes its own `dateFormat`
 * into it. `CustomDateAdapter.format` then reads that shared value and ignores the
 * `displayFormat` Material hands it. Reading the code, it is not obvious whether the
 * last picker to initialise ends up formatting all of them.
 *
 * It matters because the failure is quiet and hard to reproduce from one field: a year
 * field showing `03/04/2026`, or a day field showing `2026`. Both are wrong, both look
 * like a date, and neither errors.
 *
 * `09-temporal` has three date pickers, so this is the shape that would expose it. The
 * two years differ and the day-of-month cannot be read as a month, so a value formatted
 * with the wrong pattern cannot coincidentally look right.
 */
test.describe('date display formats', () => {
  test('a year field and a day field each use their own format', async ({ page }) => {
    await open(page, '09-temporal', undefined, '15-date-formats-instance');

    const year = page.locator('input[aria-label="Select Year"]').first();
    const day = page.locator('input[aria-label="Select Date"]').first();

    await expect(year, 'the year field should render year granularity only').toHaveValue('2019');
    await expect(day, 'the day field should render a full date').toHaveValue('03/04/2026');

    // Stated as its own assertion because it is the actual question: the two must not
    // have collapsed onto one shared format.
    expect(await year.inputValue()).not.toBe(await day.inputValue());
  });
});

/**
 * A host page hears what CEE has to say.
 *
 * `eventHandler` is a documented input that was stored and read nowhere, so a host
 * passing one got silence. It now forwards `MessageHandlerService`'s traces and errors —
 * the narrow reading, since that service is where the value was always routed.
 *
 * Exercised through the real input on the real web component rather than the service in
 * isolation, which `harness/test/message-handler.spec.ts` already covers. The two halves
 * answer different questions: that one asks whether the contract holds, this one asks
 * whether the input is actually wired to it.
 *
 * No trigger is needed: CEE traces its config and its language-map choice on every load,
 * which is a real message from a real path rather than something contrived. The first
 * version of this test reached for a `hideEmptyFields` warning that turned out not to
 * fire from a config flag — the handler had been receiving four traces all along.
 */
test.describe('the host event handler', () => {
  test('receives CEE diagnostics through the web component input', async ({ page }) => {
    await open(page, '01-input-types', undefined, undefined, undefined, '&e=1');

    const events = await page.evaluate(() => (window as any).__ceeEvents);
    expect(Array.isArray(events), 'the host page did not attach a handler').toBe(true);
    expect(events.length, 'CEE emitted nothing to the injected handler').toBeGreaterThan(0);
    expect(
      events.some((e: any) => String(e.label).includes('config set to')),
      `expected the config trace; got ${JSON.stringify(events.map((e: any) => String(e.label).slice(0, 40)))}`,
    ).toBe(true);
    expect(
      events.every((e: any) => e.kind === 'trace' || e.kind === 'error'),
      'an event arrived under a kind the handler did not declare',
    ).toBe(true);
  });

  test('gets nothing when no handler is attached, and CEE still renders', async ({ page }) => {
    await open(page, '01-input-types');

    const events = await page.evaluate(() => (window as any).__ceeEvents);
    expect(events, 'no handler was attached, so nothing should have been recorded').toEqual([]);
    // The point of the negative case: the same code path runs, and is harmless.
    await expect(page.locator('input[aria-label="text"]')).toBeVisible();
  });

  test('receives a host-input error, not only startup traces', async ({ page }) => {
    await open(page, '01-input-types', undefined, undefined, undefined, '&e=1');
    await page.evaluate(async () => {
      (window as any).__ceeEvents = [];
      const template = await (await fetch('./fixtures/01-input-types.json')).json();
      (document.querySelector('cedar-embeddable-editor') as any).templateAndInstanceObject = {
        templateObject: template,
      };
    });

    await expect(async () => {
      const events = await page.evaluate(() => (window as any).__ceeEvents);
      expect(
        events.some((event: any) => event.kind === 'error' && event.label.includes('Instance Object is missing')),
      ).toBe(true);
    }).toPass();
  });
});

/**
 * The two host entry points that fetch.
 *
 * `loadConfigFromURL` and the sample-template loader were the last inputs a host page
 * uses that no test touched, and both were untestable until the harness page served
 * something to fetch. Neither is a data input: in both cases CEE ends up with a
 * configuration or a template **without being handed one**, which is the whole point and
 * the reason they are worth covering — a host that relies on either has no other way to
 * find out it broke.
 */
test.describe('host inputs that fetch', () => {
  const openHost = async (page: import('@playwright/test').Page, query: string) => {
    await page.clock.setFixedTime(FROZEN);
    await page.goto(`/host.html?${query}&b=${BUNDLE_VERSION}`);
    await page.waitForFunction(() => (window as any).__ceeReady === true || (window as any).__ceeError, null, {
      timeout: 20_000,
    });
    expect(await page.evaluate(() => (window as any).__ceeError)).toBeFalsy();
  };

  const events = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as any).__ceeConfigEvents ?? []);

  test('loadConfigFromURL applies the fetched config and calls the success handler', async ({ page }) => {
    await openHost(page, 'host=config');

    await expect(async () => {
      expect((await events(page)).length, 'no handler was called').toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    const seen = await events(page);
    expect(seen[0].kind, `expected success, got ${JSON.stringify(seen[0])}`).toBe('success');
    // The handler receives the parsed config, not the raw text.
    expect(seen[0].config.showFooter, 'the parsed config should reach the handler').toBe(true);

    /**
     * And it was *applied*, not merely parsed — which needs a template, since CEE renders
     * nothing at all without one. So hand it one now, in the order a host would: fetch the
     * config, then supply the document. The footer is off in every preset here, so its
     * appearance can only come from the fetched config.
     */
    await page.evaluate(async () => {
      const template = await (await fetch('./fixtures/01-input-types.json')).json();
      (document.querySelector('cedar-embeddable-editor') as any).templateObject = template;
    });
    await expect(page.locator('footer.main__footer'), 'the fetched config was parsed but not applied').toBeVisible({
      timeout: 10_000,
    });
  });

  test('loadConfigFromURL calls the error handler for a URL that is not there', async ({ page }) => {
    await openHost(page, 'host=config&url=./served/does-not-exist.json');

    await expect(async () => {
      expect((await events(page)).length, 'no handler was called for a 404').toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    const seen = await events(page);
    expect(seen[0].kind).toBe('error');
    expect(seen[0].status, 'the handler should receive the xhr, so a host can see the status').toBe(404);
  });

  /**
   * A 200 carrying something that is not JSON.
   *
   * `loadConfigFromURL` calls `JSON.parse` on any 200 with no guard, so a URL that
   * returns an HTML error page — a login redirect, a proxy notice, a misconfigured path —
   * used to throw inside the XHR callback and call **neither** handler: the host was told
   * nothing at all and could not distinguish it from a request still in flight. The parse
   * is now guarded and the failure is reported as an error, which is what a host has an
   * error handler for.
   */
  test('loadConfigFromURL reports a response that is not JSON as an error', async ({ page }) => {
    await openHost(page, 'host=config&url=./served/not-json.json');

    await expect(async () => {
      expect((await events(page)).length, 'a non-JSON 200 told the host nothing').toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    const seen = await events(page);
    expect(seen[0].kind, 'a body that will not parse is an error, not a success').toBe('error');
  });

  /**
   * The sample-template loader, which is the route the CEDAR demo pages use.
   *
   * Given only `sampleTemplateLocationPrefix` and `loadSampleTemplateName`, CEE builds
   * `<prefix><name>/template.json` and `<prefix><name>/metadata.json` itself, fetches
   * both, and assembles them into `templateAndInstanceObject`. So this covers the
   * filename convention, the fetch, and the hand-off in one — and the metadata's value is
   * something the template does not default to, so a form that renders with an empty
   * field would fail rather than look right.
   */
  test('the sample-template loader fetches a template and its metadata', async ({ page }) => {
    await openHost(page, 'host=sample');

    const field = page.locator('input[aria-label="title"]');
    await expect(field, 'no template was loaded from the sample location').toBeVisible({ timeout: 10_000 });
    await expect(field, 'the template loaded but its metadata did not').toHaveValue('loaded from metadata.json');
  });

  test('a missing sample template leaves CEE standing and says so', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });

    await openHost(page, 'host=sample&sample=nonexistent');

    await expect(async () => {
      expect(
        errors.some((e) => e.includes('Error while loading sample template')),
        `expected a load error on the console; got ${JSON.stringify(errors.slice(0, 3))}`,
      ).toBe(true);
    }).toPass({ timeout: 10_000 });

    // The failure is reported rather than thrown: no form, but nothing broken either.
    await expect(page.locator('input[aria-label="title"]')).toHaveCount(0);
  });

  /**
   * Translation is a third entry point that fetches, and the least covered.
   *
   * `FallbackTranslateLoader` asks `TranslateHttpLoader` for
   * `<languageMapPathPrefix><lang>.json` and falls back to the bundled map when that
   * fails. Every existing test took the fallback — the multi-editor route points at a
   * prefix that is not there, so it 404s on every run — which meant the fetch itself was
   * exercised only by failing. An external map that loads and wins was covered nowhere.
   *
   * That is the wrong half to leave untested. `@ngx-translate/http-loader` is a
   * third-party package on its own release schedule, and a loader that silently stops
   * fetching does not look broken: it looks like the built-in text, which is what CEE
   * shows when everything is fine.
   *
   * Both directions are asserted here, against the same string, so neither reading can
   * be mistaken for the other.
   */
  const BUILT_IN_FOOTER = 'CEDAR is maintained by the Stanford Division of Computational Medicine.';
  const SERVED_FOOTER = 'Maintained per an externally served language map.';

  const loadTemplateIntoHost = (page: import('@playwright/test').Page) =>
    page.evaluate(async () => {
      const template = await (await fetch('./fixtures/01-input-types.json')).json();
      (document.querySelector('cedar-embeddable-editor') as any).templateObject = template;
    });

  test('an externally served language map is fetched and overrides the built-in one', async ({ page }) => {
    await openHost(page, 'host=lang');
    await loadTemplateIntoHost(page);

    const footer = page.locator('footer.main__footer');
    await expect(footer).toBeVisible({ timeout: 10_000 });
    await expect(footer, 'the served language map did not reach the rendered form').toContainText(SERVED_FOOTER);
    await expect(footer, 'the built-in map should have been overridden').not.toContainText(BUILT_IN_FOOTER);
  });

  test('an unreachable language map falls back to the built-in one', async ({ page }) => {
    await openHost(page, 'host=lang&prefix=./served/no-such-languages/');
    await loadTemplateIntoHost(page);

    const footer = page.locator('footer.main__footer');
    await expect(footer).toBeVisible({ timeout: 10_000 });
    await expect(footer, 'a 404 on the language map should not blank the interface').toContainText(BUILT_IN_FOOTER);
  });
});
