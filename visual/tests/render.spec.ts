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
import { elementIrisOf, literalNode, valueOf } from './values';
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

  /**
   * The host's root font size, which is the one thing a shadow boundary does not
   * keep out.
   *
   * `rem` resolves against the host document's root element, not the shadow root,
   * so every rem in CEE was a ratio applied to a number the embedder chose —
   * often without meaning to. `html { font-size: 62.5% }` is a common reset idiom,
   * and under it a section-break heading declared at `1.25rem` rendered at
   * 12.5px instead of 20px, and every rem-sized gap and column shrank with it.
   * CEE could neither see that nor report it.
   *
   * Measured against 62.5% rather than a plausible-looking value, because it is
   * the idiom that actually appears in host stylesheets.
   *
   * Scoped to what CEE states, which is what it can fix. Angular Material's own
   * stylesheet still carries rem — a button's metrics among them — so under 62.5%
   * an `Expand All` button narrows from 121px to 114px while its 14px label does
   * not move. That is a residue in a dependency, not in CEE, and it is the reason
   * the widths below are CEE's own boxes rather than every box on the page: the
   * template title sits in a `1fr` grid column beside those buttons and inherits
   * their shrinkage.
   */
  test('the host page cannot resize CEE by changing its root font size', async ({ page }) => {
    // The description is off in `base`, and it is the only consumer of
    // `$cee-font-size-lead` — so it is turned on rather than left uncovered.
    await open(page, '17-real-flat', undefined, undefined, undefined, '&f=showTemplateDescription');

    const measure = () =>
      page.evaluate(() => {
        const root = document.querySelector('cedar-embeddable-editor')!.shadowRoot!;
        const read = (selector: string, what: 'type' | 'box') => {
          const element = root.querySelector(selector);
          if (!element) return null;
          if (what === 'type') return getComputedStyle(element).fontSize;
          const rect = element.getBoundingClientRect();
          return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
        };
        return {
          // Every size CEE states, which is the reviewer's symptom.
          typeSectionBreak: read('.section-break-header', 'type'),
          typeTemplateLabel: read('.template-label', 'type'),
          typeTemplateDescription: read('.template-description', 'type'),
          typeVersion: read('.cee-version', 'type'),
          typeFieldLabel: read('app-cedar-component-header .title', 'type'),
          typeValue: read('input[aria-label="Text Field"]', 'type'),
          typeHint: read('mat-hint', 'type'),
          typeClock: read('.cee-time-segment', 'type'),
          // And the boxes CEE sizes itself.
          boxSectionBreak: read('.section-break-header', 'box'),
          boxVersion: read('.cee-version', 'box'),
          boxDate: read('.cee-temporal-date', 'box'),
          boxOffset: read('.cee-temporal-offset', 'box'),
          boxClock: read('.cee-time-input-shell', 'box'),
        };
      });

    const before = await measure();
    // Every entry has to be present, or the comparison proves nothing.
    expect(Object.entries(before).filter(([, value]) => value === null)).toEqual([]);

    await page.addStyleTag({ content: 'html { font-size: 62.5% }' });
    await page.waitForTimeout(200);

    expect(await measure(), 'a host root font size must not resize the editor').toEqual(before);
  });

  /**
   * A text field is the same height in every template.
   *
   * It was not. `timezone-picker.component.scss` carried
   * `::ng-deep .mat-mdc-form-field-infix`, and Angular scopes the part of a
   * selector *before* `::ng-deep` — so with nothing before it the rule was
   * emitted with no scoping attribute and applied to every form field in the
   * editor, beating the compact rule in `styles-own.scss` from later in the
   * cascade at equal specificity.
   *
   * What made it invisible is that component styles are injected when the
   * component is first instantiated, so the rule only existed once a timezone
   * picker did. A template with a timezone-enabled temporal field rendered all of
   * its fields at 48px; a template without one rendered them at 36px. No
   * stylesheet in the repository claimed that, and no screenshot could show it,
   * because each fixture has only ever been compared against itself.
   *
   * Which is the general shape of the bug and the reason this test compares two
   * fixtures rather than measuring one: a leaked rule looks completely normal
   * anywhere it is the only rule.
   */
  test('a field box is the same height whatever else the template contains', async ({ page }) => {
    const textFieldHeight = async (fixture: string) => {
      await open(page, fixture);
      return page
        .locator('app-cedar-input-text .mat-mdc-form-field-infix')
        .first()
        .evaluate((infix) => {
          const style = getComputedStyle(infix);
          return `${style.minHeight} ${style.paddingTop}/${style.paddingBottom}`;
        });
    };

    // `01-input-types` holds no temporal field with a timezone; `17-real-flat`
    // holds two, and a text field to compare.
    const withoutOffset = await textFieldHeight('01-input-types');
    const withOffset = await textFieldHeight('17-real-flat');

    expect(withOffset, 'a timezone picker elsewhere on the page resized this field').toBe(withoutOffset);
  });

  /**
   * A field box is the same height empty and filled.
   *
   * It was not, and this is what settled the height question. CEE draws a clear
   * action in every widget that can hold a value, shown `@if` the value is there,
   * and Material's icon button is 48px — taller than the 36px compact infix the
   * theme asked for, so the flex row grew the moment a user typed. Measured before
   * the density change: text, email, link and phone each 36px empty and 48px
   * filled, numeric 36px throughout because its suffix is a unit label rather than
   * a button. The form reflowed field by field as it was completed, and the
   * "compact" height was only ever the height of a blank form.
   *
   * Asserted on the page rather than on one widget, because the defect was the
   * mix: a filled form held both heights at once.
   */
  test('a field box is the same height empty and filled', async ({ page }) => {
    await open(page, '01-input-types');

    const heights = () =>
      page.locator('app-cedar-input-text, app-cedar-input-email, app-cedar-input-link').evaluateAll((widgets) =>
        widgets.map((widget) => {
          const input = widget.querySelector('input');
          const box = input?.closest('.mat-mdc-text-field-wrapper');
          return box ? Math.round(box.getBoundingClientRect().height) : null;
        }),
      );

    const empty = await heights();

    await page.locator('input[aria-label="text"]').fill('a filled value');
    await page.locator('input[aria-label="email"]').fill('someone@example.org');
    await page.locator('input[aria-label="link"]').fill('https://example.org/thing');
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);

    expect(await heights(), 'a field changed height when it gained a value').toEqual(empty);
  });

  /**
   * The guarantee, not the mechanism that used to deliver it.
   *
   * What matters is that overlay content renders inside the editor's shadow root
   * and never lands in the host document — that is what keeps CEE's styles reaching
   * it and keeps it out of an embedder's way. It used to be asserted by looking for
   * the content inside `.cee-overlay-container`, which was true right up until
   * Angular Material 21 stopped routing `mat-select` through the CDK overlay at all
   * and began rendering its panel inline.
   *
   * Nothing was broken by that — the options are still in the shadow root, still
   * nowhere in `body` — but the old assertion failed, having pinned one
   * implementation of the guarantee rather than the guarantee.
   *
   * The container is still doing its job for everything that does use it, so that
   * is checked too, on the datepicker: 151 elements land there and none in `body`.
   * If Material ever routes those inline as well, this notices.
   */
  test('Material overlays stay inside the editor shadow root', async ({ page }) => {
    await open(page, '02-choices');
    await page.locator('mat-select').first().click();
    await expect(page.locator('mat-option').first()).toBeVisible();

    const panel = await page.evaluate(() => {
      const editor = document.querySelector('cedar-embeddable-editor') as HTMLElement;
      return {
        inShadowRoot: editor.shadowRoot?.querySelectorAll('mat-option').length ?? 0,
        leakedToBody: document.body.querySelectorAll(':scope > .cdk-overlay-container').length,
      };
    });
    expect(panel.inShadowRoot, 'the select panel rendered outside the editor').toBeGreaterThan(0);
    expect(panel.leakedToBody, 'an overlay container was attached to the host document').toBe(0);

    await open(page, '09-temporal');
    await page.locator('mat-datepicker-toggle button').first().click();
    await page.waitForTimeout(300);

    const calendar = await page.evaluate(() => {
      const editor = document.querySelector('cedar-embeddable-editor') as HTMLElement;
      return {
        inCeeContainer: editor.shadowRoot?.querySelectorAll('.cee-overlay-container *').length ?? 0,
        leakedToBody: document.body.querySelectorAll(':scope > .cdk-overlay-container').length,
      };
    });
    expect(calendar.inCeeContainer, 'the datepicker no longer uses CEE overlay container').toBeGreaterThan(0);
    expect(calendar.leakedToBody, 'an overlay container was attached to the host document').toBe(0);
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

    const instances = await page.evaluate(() => {
      const first = document.querySelector('#editor-first') as any;
      const second = document.querySelector('#editor-second') as any;
      return { first: first.currentMetadata, second: second.currentMetadata };
    });
    const firstElementIds = elementIrisOf(instances.first);
    const secondElementIds = elementIrisOf(instances.second);
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

test.describe('field type markers', () => {
  test('simple fields use the bundled icon font without adding accessible noise', async ({ page }) => {
    await open(page, '01-input-types');

    const slots = page.locator('[data-field-type-icon]');
    await expect(slots).toHaveCount(7);
    await expect(slots.locator('.field-type-icon')).toHaveText([
      'short_text',
      'notes',
      'dialpad',
      'email',
      'phone',
      'link',
      'event',
    ]);

    const renderedIcons = await slots.evaluateAll((elements) =>
      elements.map((slot) => {
        const icon = slot.querySelector('.field-type-icon') as HTMLElement;
        return {
          ariaHidden: slot.getAttribute('aria-hidden'),
          fontFamily: getComputedStyle(icon).fontFamily,
          clientWidth: icon.clientWidth,
          scrollWidth: icon.scrollWidth,
        };
      }),
    );
    expect(renderedIcons).toEqual(
      renderedIcons.map((icon) => ({
        ...icon,
        ariaHidden: 'true',
        fontFamily: '"CEE Material Icons"',
        scrollWidth: icon.clientWidth,
      })),
    );
  });

  test('controlled terms get the ontology marker while authority fields keep their identities', async ({ page }) => {
    await open(page, '04-controlled-terms');

    const ontologyMarker = page.locator('.ontology-icon-slot');
    await expect(ontologyMarker).toHaveCount(1);
    await expect(ontologyMarker.locator('.field-type-icon')).toHaveText('device_hub');
    await expect(page.locator('.authority-icon-slot')).toHaveCount(2);
    await expect(page.locator('[data-field-type-icon]')).toHaveCount(1);
  });
});

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
 * Both pages are far taller than a screen, and they used to be judged by a 1% ratio —
 * which on a 1280x4418 page is a budget of some 56,000 pixels, so a small localised
 * change did not move it. Four such changes went green against these two baselines in a
 * single day. Every screenshot now has the same absolute 120-pixel budget, and the config
 * carries the measurements. Localised widget rendering is still covered clipped as well,
 * under `widgets, clipped`, because a failure there names the widget.
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

test('multi-instance pager renders its chips without covering a narrow expansion header', async ({
  page,
}, testInfo) => {
  await open(page, '03-nested-multi');
  // The pager is the most Material-dependent control in the editor: chips,
  // ripples and an icon button row. Screenshot it in isolation so a diff here
  // is unambiguous.
  const pager = page.locator('app-cedar-multi-pager').first();
  await expect(pager).toBeVisible();

  const geometry = await page.evaluate(() => {
    const root = document.querySelector('cedar-embeddable-editor')!.shadowRoot!;
    const panel = root.querySelector('mat-expansion-panel')!;
    const header = panel.querySelector('mat-expansion-panel-header')!.getBoundingClientRect();
    const controls = panel.querySelector('app-cedar-multi-pager')!.firstElementChild!.getBoundingClientRect();
    const chip = panel.querySelector('app-cedar-multi-pager mat-chip-option')!.getBoundingClientRect();
    const action = panel.querySelector('app-cedar-multi-pager button[mat-icon-button]')!.getBoundingClientRect();
    return {
      header: { top: header.top, bottom: header.bottom, center: header.top + header.height / 2 },
      controls: { top: controls.top, center: controls.top + controls.height / 2 },
      chip: { width: chip.width, height: chip.height, center: chip.top + chip.height / 2 },
      action: { center: action.top + action.height / 2 },
    };
  });
  if (testInfo.project.name === 'desktop') {
    expect(Math.abs(geometry.header.center - geometry.controls.center)).toBeLessThan(1);
  } else {
    expect(geometry.controls.top, 'the pager should form a separate row below a narrow header').toBeGreaterThanOrEqual(
      geometry.header.bottom,
    );
  }
  // Material lands at 32.125px on this font/device scale; keep the visual
  // circle within the intended compact 32px class rather than asserting away
  // a sub-pixel rasterisation detail.
  expect(Math.max(geometry.chip.width, geometry.chip.height)).toBeLessThanOrEqual(33);
  expect(Math.abs(geometry.chip.center - geometry.action.center)).toBeLessThan(1);

  await expect(pager).toHaveScreenshot('pager.png');
});

test('multi-instance actions track cardinality and always expose tooltips', async ({ page }) => {
  await open(page, '10-attribute-values');

  const renderer = page.locator('app-cedar-component-renderer').filter({
    has: page.locator('input[aria-label="Attribute Name"]'),
  });
  const add = renderer.getByRole('button', { name: 'Add empty after current', exact: true });
  const copy = renderer.getByRole('button', { name: 'Add clone after current', exact: true });
  const remove = renderer.getByRole('button', { name: 'Delete current', exact: true });

  await expect(add).toBeEnabled();
  await expect(copy).toBeEnabled();
  await expect(remove).toBeDisabled();

  await add.click();
  await expect(remove).toBeEnabled();

  await add.click();
  await add.click();
  await expect(add).toBeDisabled();
  await expect(copy).toBeDisabled();
  await expect(remove).toBeEnabled();

  for (const [button, tooltip] of [
    [add, 'Add empty after current'],
    [copy, 'Add clone after current'],
    [remove, 'Delete current'],
  ] as const) {
    await button.locator('xpath=parent::span').hover();
    const surface = page.locator('.mat-mdc-tooltip-surface', { hasText: tooltip });
    await expect(surface).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(surface).toBeHidden();
  }
});

test('attribute-value labels stay distinct and its pager aligns responsively', async ({ page }, testInfo) => {
  await open(page, '10-attribute-values');

  const name = page.locator('input[aria-label="Attribute Name"]');
  const value = page.locator('input[aria-label="Attribute Value"]');
  await expect(name).toHaveCount(1);
  await expect(value).toHaveCount(1);
  await name.fill('Attribute Value Field3');

  const renderer = name.locator('xpath=ancestor::app-cedar-component-renderer');
  expect(
    await renderer
      .locator('mat-form-field')
      .evaluateAll((fields) =>
        fields.slice(0, 2).map((field) => field.querySelector('.mdc-floating-label--float-above') !== null),
      ),
    'Name and Value labels should occupy the same floating-label row',
  ).toEqual([true, true]);

  // The fixture starts at its minimum of one value; add a second so both the
  // page chips and all three actions are present, matching the deployed state.
  await renderer.locator('app-cedar-multi-pager button[mat-icon-button]').first().click();
  const geometry = await renderer.evaluate((element) => {
    const header = element.querySelector('app-cedar-component-header')!.getBoundingClientRect();
    const controls = element.querySelector('app-cedar-multi-pager')!.firstElementChild!.getBoundingClientRect();
    const action = element.querySelector('app-cedar-multi-pager button[mat-icon-button]')!.getBoundingClientRect();
    return {
      header: { bottom: header.bottom, center: header.top + header.height / 2 },
      controls: { top: controls.top },
      actionCenter: action.top + action.height / 2,
    };
  });
  if (testInfo.project.name === 'desktop') {
    expect(Math.abs(geometry.header.center - geometry.actionCenter)).toBeLessThan(1);
  } else {
    expect(
      geometry.controls.top,
      'the pager should form a separate row below a narrow field title',
    ).toBeGreaterThanOrEqual(geometry.header.bottom);
  }
});

test('a new attribute-value row starts with placeholders, not a generated name', async ({ page }) => {
  await open(page, '10-attribute-values');

  const renderer = page.locator('app-cedar-component-renderer').filter({
    has: page.locator('input[aria-label="Attribute Name"]'),
  });
  const add = renderer.locator('app-cedar-multi-pager button[aria-label="Add empty after current"]');
  await add.click();

  const name = renderer.locator('input[aria-label="Attribute Name"]');
  const value = renderer.locator('input[aria-label="Attribute Value"]');
  await expect(name).toHaveValue('');
  await expect(name).toHaveAttribute('placeholder', 'Attribute Name');
  await expect(value).toHaveValue('');
  await expect(value).toHaveAttribute('placeholder', 'Attribute Value');
});

test('an expansion panel collapses and expands', async ({ page }) => {
  await open(page, '03-nested-multi');
  const header = page.locator('mat-expansion-panel-header').first();
  await expect(header).toBeVisible();

  /**
   * A normal centre-click is deliberate. At narrow widths the pager used to
   * cover this point, switching instances instead of collapsing the panel.
   * The responsive pager row must leave the whole header as its own target.
   */
  await header.click();
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
   * is touched or its form is submitted, so focusing and blurring is the whole
   * trick — no invalid input is needed for the `required` case.
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

  test('typed format errors wait for blur and then clear live', async ({ page }) => {
    await open(page, '06-validation');

    const cases = [
      { name: 'short_text', invalid: 'abc', valid: 'abcdefgh' },
      { name: 'an_email', invalid: 'not-an-email', valid: 'valid@example.org' },
      { name: 'a_link', invalid: 'example', valid: 'https://example.org' },
      { name: 'a_phone', invalid: 'letters', valid: '+1 (650) 555-0100' },
    ];

    for (const entry of cases) {
      const input = page.locator(`input[aria-label="${entry.name}"]`);
      const error = input.locator('xpath=ancestor::mat-form-field').locator('mat-error');

      await input.fill(entry.invalid);
      await expect(error, `${entry.name} reported an error while the user was still typing`).toBeHidden();

      await input.blur();
      await expect(error, `${entry.name} did not report its error after blur`).toBeVisible();

      await input.fill(entry.valid);
      await expect(error, `${entry.name} did not clear its error as soon as the value became valid`).toBeHidden();
    }
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

test('temporal placeholders and decimal seconds fit without clipping', async ({ page }) => {
  await open(page, '09-temporal');

  /*
   * The shell, before its segments.
   *
   * Measuring each segment against its own box misses the failure that actually
   * shipped: the boxes were the right size and the shell around them was not.
   * It sat in a flex row that inherited `min-width: 0`, so a row a few pixels
   * short took them from here and cut the right stroke off `MM` — recorded in a
   * baseline as `HH:MN` and read by nobody as a defect.
   */
  const shells = page.locator('.cee-time-input-shell');
  expect(await shells.count()).toBeGreaterThan(0);
  const squeezed = await shells.evaluateAll((elements: HTMLElement[]) =>
    elements
      .filter((shell) => shell.scrollWidth > shell.clientWidth + 1)
      .map((shell) => `${shell.scrollWidth}px of content in ${shell.clientWidth}px`),
  );
  expect(squeezed, 'a clock shell must not be shrunk below the boxes it holds').toEqual([]);

  /*
   * The placeholders, measured as text.
   *
   * `scrollWidth` was what this compared against, and `scrollWidth` cannot see a
   * clipped placeholder: an empty input has nothing to scroll, so the assertion
   * passed while `MM` — 24.4px of text in a 23.6px box — lost the right stroke of
   * its second stem. Rendering the text on a canvas in the segment's own font is
   * what makes the comparison the one intended.
   */
  const segments = page.locator('.cee-time-segment');
  expect(await segments.count()).toBeGreaterThan(0);
  const clipped = await segments.evaluateAll((inputs: HTMLInputElement[]) => {
    const measure = document.createElement('canvas').getContext('2d')!;
    return inputs
      .map((input) => {
        const style = getComputedStyle(input);
        measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return { placeholder: input.placeholder, available, needed: measure.measureText(input.placeholder).width };
      })
      .filter((segment) => segment.needed > segment.available)
      .map((segment) => `${segment.placeholder} needs ${segment.needed.toFixed(1)}px, has ${segment.available}px`);
  });
  expect(clipped, 'a placeholder is wider than the box that shows it').toEqual([]);

  const fraction = page.locator('input[aria-label="Select Decimal Seconds"]');
  await fraction.fill('999');
  const fractionFit = await fraction.evaluate((input: HTMLInputElement) => ({
    clientWidth: input.clientWidth,
    scrollWidth: input.scrollWidth,
  }));
  expect(fractionFit.scrollWidth).toBeLessThanOrEqual(fractionFit.clientWidth + 1);
});

test('radio selection uses primary color and keeps Clear on the selected row', async ({ page }) => {
  await open(page, '02-choices');

  const selected = page.getByRole('radio', { checked: true });
  await expect(selected).toHaveAccessibleName('Beta');
  const row = selected.locator('xpath=ancestor::div[contains(@class, "choice-option-row")]');
  const clear = row.getByRole('button', { name: 'Clear', exact: true });
  await expect(clear).toBeVisible();

  const geometry = await row.evaluate((element) => {
    const radio = element.querySelector('mat-radio-button')!.getBoundingClientRect();
    const button = element.querySelector('button')!.getBoundingClientRect();
    const radioButton = element.querySelector('mat-radio-button')!;
    return {
      centers: [radio.top + radio.height / 2, button.top + button.height / 2],
      selectedColor: getComputedStyle(radioButton).getPropertyValue('--mat-radio-selected-icon-color').trim(),
    };
  });
  expect(Math.abs(geometry.centers[0] - geometry.centers[1])).toBeLessThan(1);
  expect(geometry.selectedColor).toBe('#00897b');
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

test('the editor shrinks to its host without horizontal overflow', async ({ page }) => {
  await open(page, '17-real-flat');

  const layout = await page.evaluate(() => {
    const host = document.querySelector('cedar-embeddable-editor');
    const header = host?.shadowRoot?.querySelector('.template-header');
    const actions = host?.shadowRoot?.querySelector('.template-actions');
    const rect = (element: Element | null | undefined) => element?.getBoundingClientRect();

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      host: rect(host),
      header: rect(header),
      actions: rect(actions),
    };
  });

  expect(layout.documentWidth, 'CEE must not make the embedding document wider than its viewport').toBeLessThanOrEqual(
    layout.viewportWidth,
  );
  expect(layout.host).toBeTruthy();
  expect(layout.header).toBeTruthy();
  expect(layout.actions).toBeTruthy();
  expect(layout.header!.left).toBeGreaterThanOrEqual(layout.host!.left);
  expect(layout.header!.right).toBeLessThanOrEqual(layout.host!.right);
  expect(layout.actions!.left).toBeGreaterThanOrEqual(layout.host!.left);
  expect(layout.actions!.right).toBeLessThanOrEqual(layout.host!.right);
});

test('element headings establish hierarchy without doubling the first content gap', async ({ page }) => {
  await open(page, '18-real-nested', 'readonly');
  await page.locator('.page-break-paginator-container mat-chip-option', { hasText: '2' }).first().click();
  await page.waitForTimeout(300);

  const panel = page.locator('mat-expansion-panel', { hasText: 'Wrapper then Nested (single)' }).first();
  const readMetrics = () =>
    panel.evaluate((element) => {
      const header = element.querySelector(':scope > mat-expansion-panel-header')!.getBoundingClientRect();
      const title = element.querySelector(':scope > mat-expansion-panel-header mat-panel-title')!;
      const firstFieldHeader = element
        .querySelector(
          ':scope > .mat-expansion-panel-content-wrapper > .mat-expansion-panel-content > .mat-expansion-panel-body > .cee-element-content > app-cedar-component-renderer:first-of-type > .non-iterable-component > app-cedar-component-header',
        )!
        .getBoundingClientRect();
      const titleStyle = getComputedStyle(title);
      return {
        fontSize: titleStyle.fontSize,
        fontWeight: titleStyle.fontWeight,
        contentGap: firstFieldHeader.top - header.bottom,
      };
    });

  expect(await readMetrics()).toEqual({ fontSize: '18px', fontWeight: '600', contentGap: 12 });

  await page.locator('cedar-embeddable-editor').evaluate((host) => {
    const style = (host as HTMLElement).style;
    style.setProperty('--cee-element-heading-size', '18px');
    style.setProperty('--cee-element-heading-weight', '700');
    style.setProperty('--cee-element-content-gap', '8px');
  });

  expect(await readMetrics()).toEqual({ fontSize: '18px', fontWeight: '700', contentGap: 8 });
});

/**
 * What an embedder can do to the published properties, and what CEE does about it.
 *
 * These are public API, so a host page can put anything in them, and before this
 * nothing bounded what happened next. `--cee-element-heading-size: 100px` left the
 * expansion-panel header at its own 64px while the text escaped it — the heading
 * clipped mid-word with no ellipsis, and a nested element's heading drew over the
 * field list below. `999px` was accepted the same way.
 *
 * Two mechanisms answer two different mistakes, which is why both exist and why
 * this test names both. `clamp()` bounds a value that is valid but ruinous.
 * Registering the property with a `syntax` handles one of the wrong *type*: those
 * used to make the declaration invalid at computed-value time, so `font-size`
 * inherited and a typo rendered at the 14px body size rather than at the 18px
 * default — the worst outcome, because it looks deliberate.
 *
 * Asserted through the real element rather than a probe: `registerCeeThemeProperties`
 * runs from the bundle's entry point, so this is also the test that it ran at all.
 */
test('published theme properties are bounded, and a bad value falls back to the default', async ({ page }) => {
  await open(page, '18-real-nested', 'readonly');
  await page.locator('.page-break-paginator-container mat-chip-option', { hasText: '2' }).first().click();
  await page.waitForTimeout(300);

  const panel = page.locator('mat-expansion-panel', { hasText: 'Wrapper then Nested (single)' }).first();
  const headingSize = () =>
    panel.evaluate(
      (element) =>
        getComputedStyle(element.querySelector(':scope > mat-expansion-panel-header mat-panel-title')!).fontSize,
    );
  const set = (value: string | null) =>
    page.locator('cedar-embeddable-editor').evaluate((host, v) => {
      const style = (host as HTMLElement).style;
      if (v === null) style.removeProperty('--cee-element-heading-size');
      else style.setProperty('--cee-element-heading-size', v);
    }, value);

  expect(await headingSize(), 'the default should sit inside the clamp untouched').toBe('18px');

  // Valid but ruinous: bounded rather than obeyed.
  await set('100px');
  expect(await headingSize()).toBe('32px');
  await set('999px');
  expect(await headingSize()).toBe('32px');
  await set('1px');
  expect(await headingSize()).toBe('12px');

  // `rem` resolves against the host page's root, which is the dependence
  // `_cee-tokens.scss` removed from CEE's own sizes. The clamp keeps an embedder
  // from reintroducing it without bound.
  await set('3rem');
  expect(await headingSize()).toBe('32px');

  // Wrong *type*: the registered `<length>` syntax discards it in favour of the
  // initial value. Unregistered this gave 14px, the inherited body size, which is
  // the failure worth preventing because it looks deliberate.
  await set('banana');
  expect(await headingSize(), 'a typo must fall back to the published default').toBe('18px');

  // A negative length is a *valid* `<length>`, so registration passes it through
  // and the clamp floors it — the same treatment `100px` gets at the other end.
  // This is the seam between the two mechanisms, so it is asserted rather than
  // assumed: unregistered and unclamped, this rendered at 14px.
  await set('-20px');
  expect(await headingSize(), 'a negative length must be floored by the clamp').toBe('12px');

  await set(null);
  expect(await headingSize()).toBe('18px');
});

test('page navigation keeps its controls in a compact row', async ({ page }) => {
  await open(page, '17-real-flat', 'readonly');

  const pager = await page.locator('.page-break-paginator-container').evaluate((element) => {
    const box = element.getBoundingClientRect();
    const rangeLabel = element.querySelector('.mat-mdc-paginator-range-label');
    const rangeStyle = rangeLabel ? getComputedStyle(rangeLabel) : null;
    return {
      height: box.height,
      hiddenRangeMargin: rangeStyle?.margin ?? null,
    };
  });

  expect(pager.height, 'page controls should fit in one 48px row').toBeLessThanOrEqual(48);
  expect(pager.hiddenRangeMargin, 'the hidden Material range label must not reserve space').toBe('0px');
});

test('numeric units are inset from the input outline', async ({ page }) => {
  await open(page, '17-real-flat', 'readonly');

  const unitInset = await page.locator('.cee-numeric-unit', { hasText: 'mg' }).evaluate((unit) => {
    const field = unit.closest('mat-form-field')!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(unit);
    const text = range.getBoundingClientRect();
    return field.right - text.right;
  });

  expect(unitInset, 'unit text should not touch the field outline').toBeGreaterThanOrEqual(10);
});

/**
 * The bounds hint, as a reader meets it.
 *
 * It used to read `min: 0; max: 100;` — abbreviated, semicolon-delimited and
 * assembled from string fragments in the component while every other visible
 * string came from a language bundle. Asserting the rendered text is what makes
 * the wording a commitment rather than an implementation detail, and it covers
 * the three shapes independently: both bounds, a decimal limit alone, and all
 * three at once.
 */
test('numeric fields state their bounds in words', async ({ page }) => {
  await open(page, '17-real-flat');

  // Fields are addressed by aria-label, as elsewhere in this suite.
  const hintFor = (label: string) =>
    page
      .locator('app-cedar-input-numeric')
      .filter({ has: page.locator(`input[aria-label="${label}"]`) })
      .locator('mat-hint');

  await expect(hintFor('Numeric Field')).toHaveText('Minimum: 0, Maximum: 100');
  await expect(hintFor('Numeric Decimal (4 dp)')).toHaveText('Decimal places: 4');
  await expect(hintFor('Numeric Decimal (2 dp)')).toHaveText('Minimum: 0, Maximum: 1000, Decimal places: 2');
});

/**
 * One type size for a field's label and for the value inside it.
 *
 * They were two. CEE's chrome is `$cee-font-size`, and Material's typography
 * config named only a font family — so a form field took M2's `subtitle-1` and
 * `body-1`, both 16px, for the text a user types. A temporal row showed a 14px
 * label, a 16px date and a 14px clock in the same row.
 *
 * Asserted as an equality between the two rather than against a number, so it
 * stays true if the size is ever changed and false if only one of them is. It
 * It had to be a DOM assertion: this changed the type size of every field on the
 * page and both corpus baselines still passed, the budget then being a ratio on
 * pages thousands of pixels tall. The budget is absolute now, so a repeat would be
 * caught in pixels too — the assertion stays because it names the property that must
 * hold, which a screenshot never does.
 */
test('a field states its label and its value at one size', async ({ page }) => {
  await open(page, '17-real-flat');

  const mismatched = await page.locator('input, textarea').evaluateAll((controls: HTMLInputElement[]) =>
    controls
      // Radio and checkbox inputs are Material's own, visually hidden behind a
      // drawn control, and carry a size nobody sees.
      .filter((control) => control.type !== 'radio' && control.type !== 'checkbox')
      .map((control) => {
        const renderer = control.closest('app-cedar-component-renderer');
        const label = renderer?.querySelector(':scope > * > app-cedar-component-header .title');
        if (!label) {
          return null;
        }
        const labelSize = getComputedStyle(label).fontSize;
        const valueSize = getComputedStyle(control).fontSize;
        return labelSize === valueSize ? null : `${label.textContent!.trim()}: label ${labelSize}, value ${valueSize}`;
      })
      .filter((problem): problem is string => problem !== null),
  );

  expect(mismatched, 'a label and the value under it should be one size').toEqual([]);
});

/**
 * One clipped screenshot per widget.
 *
 * The twelve full-page fixtures above are the wrong instrument for a widget-level
 * regression, and the footer rebrand proved it: a new logo, a new organisation
 * name and a new link changed 0.708% of the desktop page and 0.897% of the
 * narrow one, against the 1% ratio the config applied at the time, and
 * `preset-chrome` reported green. Nothing about that is specific to footers. A single
 * widget is a small fraction of any of these pages, so a widget that rendered wrong
 * after the Material 15 MDC rewrite could move every pixel it owned and still come in
 * under the page's budget.
 *
 * The ratio is gone — every screenshot carries the same absolute budget now — so this
 * is no longer the only sensitive instrument. Clipping still buys two things a page
 * shot cannot: a failure names the widget instead of handing
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
  // Same widget, with a maximum the template declared. Its hint states the
  // number; the unbounded one above shows no hint at all.
  { name: 'input-select-multi-bounded', selector: 'app-cedar-input-select', fixture: '02-choices', nth: 2 },
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

/*
 * No budget of its own any more.
 *
 * These clipped shots carried `maxDiffPixels: 120` while the config allowed every
 * other screenshot 1% of its own area — the absolute budget was introduced here,
 * for the smallest images, and the tall pages that most needed it kept the ratio.
 * The config now applies the same 120 to everything, so an override here would
 * only restate it. `playwright.config.ts` holds the number and the reasoning.
 */

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
      await expect(element).toHaveScreenshot(`widget-${widget.name}.png`);
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
 * 0.897% of the narrow one — under the 1% ratio the config applied at the time, so
 * both projects reported green. Narrow cleared it by a tenth of a percentage point.
 *
 * The conclusion drawn here was that the ratio should stay, on the grounds that it
 * absorbs cross-machine font rasterisation and that tightening it globally would
 * trade a silent failure for a noisy one. That was wrong, and four stale-but-green
 * baselines in one day are what showed it: rasterisation variance does not scale with
 * image area, so an absolute budget absorbs it just as well while staying sensitive on
 * a tall page. The ratio is gone. What follows is still worth having for what it says
 * when it fails. So:
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
/**
 * A chosen controlled term reads the way a chosen authority term reads.
 *
 * It did not. The controlled widget composed `label - (iri)` while the seven
 * authority fields compose `label - iri` through `getCompoundValue`, so two boxes
 * one row apart showed the same kind of value in two forms.
 *
 * Reaching this state normally needs a live terminology server, which the visual
 * suite deliberately cannot contact — which is why the display form had no test at
 * all and was free to drift. An instance fixture supplies the selected term
 * instead, through the same `instanceObject` input a host page uses, so no lookup
 * happens and nothing is stubbed.
 *
 * Read-only, because that is the only mode the compound form is used in:
 * `setCurrentValue` composes `label - iri` when the field is not editable, and
 * otherwise puts the bare label in the box for typing. It is also the mode
 * openview runs in, which is where this was reported from.
 */
test('a selected controlled term reads like a selected authority term', async ({ page }) => {
  await open(page, '04-controlled-terms', 'readonly', '04-controlled-terms-instance');

  const organism = page.locator('input[aria-label="organism"]');
  await expect(organism).toHaveValue('disease - http://purl.obolibrary.org/obo/DOID_4');

  const shown = await organism.inputValue();
  expect(shown, 'the IRI must not be wrapped in parentheses').not.toContain('(');
});

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
    await expect(page.locator('mat-error')).toHaveCount(0);
    await expect(page.locator('.input-warning')).toHaveCount(1);
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
      await expect(page.locator('mat-error')).toHaveCount(0);
      await expect(page.locator('.input-warning')).toHaveCount(1);
    });

    /** Each widget's message names its own authority. */
    test(`${label}: the message names the right authority`, async ({ page }) => {
      await open(page, '08-authority');

      const input = page.locator(`input[aria-label="${name}"]`);
      await input.pressSequentially('zzz nonsense', { delay: 15 });
      await page.waitForTimeout(500);
      await input.blur();
      await page.waitForTimeout(600);

      await expect(page.locator('.input-warning')).toContainText(label);
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
    valueOf(
      await page.evaluate(() => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata),
      field,
    );

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

  /**
   * How wide a clock holding a time is.
   *
   * The boxes have to fit `HH`, `MM` and `SS` when empty, and M is half again as
   * wide as a digit — so a box sized once, for both states, leaves half a digit
   * of air on either side of every colon and the clock reads `14 : 30 : 15`.
   *
   * Asserted against the width of the text itself rather than a pixel count, so
   * it stays a statement about the two being close and survives a change of font
   * or type size. The slack covers three boxes' 1px padding either side.
   */
  test('a filled clock is as wide as the time it shows', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_second');

    for (const [unit, value] of [
      ['Hour', '14'],
      ['Minute', '30'],
      ['Second', '15'],
    ]) {
      await picker.locator(`input[aria-label="${unit}"]`).fill(value);
    }
    await page.waitForTimeout(300);

    const slack = await picker.locator('.cee-time-input-shell').evaluate((shell) => {
      const box = getComputedStyle(shell);
      const inner =
        shell.getBoundingClientRect().width -
        parseFloat(box.paddingLeft) -
        parseFloat(box.paddingRight) -
        parseFloat(box.borderLeftWidth) -
        parseFloat(box.borderRightWidth);

      const segment = getComputedStyle(shell.querySelector('.cee-time-segment')!);
      const measure = document.createElement('canvas').getContext('2d')!;
      measure.font = `${segment.fontWeight} ${segment.fontSize} ${segment.fontFamily}`;

      return inner - measure.measureText('14:30:15').width;
    });

    expect(slack, 'the boxes are clipping the time').toBeGreaterThan(-2);
    expect(slack, 'the colons are floating in air').toBeLessThan(12);
  });

  /**
   * A temporal field is one row of controls, so they line up.
   *
   * The offset did not. Editable, it was the row's only control with a floating
   * label, and a floating label rests where Material's own 56px field puts it —
   * seven pixels below the date's text in the 48px CEE renders. Read-only it was
   * bare text, 36px tall and top-aligned against two 48px bordered boxes.
   *
   * Both are geometry rather than appearance, so both are measured. A clipped
   * screenshot of this row would carry the diff too, but it would not say which
   * of the three moved.
   */
  test.describe('a temporal row lines its controls up', () => {
    const boxes = (page: import('@playwright/test').Page, selectors: Record<string, string>) =>
      page
        .locator('app-cedar-input-datetime')
        .first()
        .evaluate((host, wanted) => {
          const out: Record<string, { top: number; height: number } | null> = {};
          for (const [name, selector] of Object.entries(wanted)) {
            const element = host.querySelector(selector);
            const rect = element?.getBoundingClientRect();
            out[name] = rect ? { top: Math.round(rect.top), height: Math.round(rect.height) } : null;
          }
          return out;
        }, selectors);

    /*
     * The row stacks below 620px, by a container query — so `top` is only
     * comparable in the desktop project, while the height each control takes is
     * the claim at either width. Asserted separately rather than skipping the
     * narrow project, because a 36px control among 48px ones is the read-only
     * defect and it stacks just the same.
     */
    const inOneRow = (width: number) => width > 620;

    test('editable: the offset reads at the same height as the date', async ({ page }) => {
      await open(page, '07-timezone');

      const row = await boxes(page, {
        dateField: '.cee-temporal-date mat-form-field',
        clock: '.cee-time-input-shell',
        offsetField: '.cee-temporal-offset mat-form-field',
        dateText: '.cee-temporal-date input',
        offsetText: '.mat-mdc-select-value',
      });
      const width = page.viewportSize()!.width;

      expect(row.offsetField!.height, 'every control in the row is one height').toBe(row.dateField!.height);
      expect(row.clock!.height).toBe(row.dateField!.height);
      expect(row.offsetText!.height, 'the offset text is as tall as the date text').toBe(row.dateText!.height);

      if (inOneRow(width)) {
        expect(row.offsetField!.top, 'the three controls are one row').toBe(row.dateField!.top);
        expect(row.clock!.top).toBe(row.dateField!.top);
        expect(row.offsetText!.top, 'the offset text sits where the date text sits').toBe(row.dateText!.top);
      }
    });

    test('readonly: the offset is boxed like the clock beside it', async ({ page }) => {
      await open(page, '07-timezone', 'readonly');

      const row = await boxes(page, {
        dateField: '.cee-temporal-date mat-form-field',
        clock: '.cee-time-picker-readonly',
        offset: '.cee-offset-readonly',
      });

      expect(row.clock!.height).toBe(row.dateField!.height);
      expect(row.offset!.height, 'a read-only offset was bare text, 36px among 48px boxes').toBe(row.dateField!.height);

      if (inOneRow(page.viewportSize()!.width)) {
        expect(row.clock!.top).toBe(row.dateField!.top);
        expect(row.offset!.top).toBe(row.dateField!.top);
      }
    });

    /**
     * Both separators in the row are the same separator.
     *
     * The `.` before the decimal-seconds box asked for 18px and took the default
     * black, while the `:` between hour, minute and second — inches away, inside
     * the same control — is 14px and #555. Two glyphs doing one job in two sizes
     * and two colours, and it was the last rendered size in the editor that
     * belonged to no scale.
     *
     * A DOM assertion rather than a baseline, because a period is roughly thirty
     * pixels and the change moved none of the 108 snapshots. That is the miss the
     * budget comment above predicts in as many words — the smaller the thing that
     * broke, the more slack a ratio gives it — so pixels cannot hold this and are
     * not asked to.
     */
    test('the decimal point matches the colons beside it', async ({ page }) => {
      await open(page, '09-temporal');

      const separators = await page
        .locator('app-cedar-input-datetime')
        .filter({ has: page.locator('.cee-fraction-separator') })
        .first()
        .evaluate((host) => {
          const read = (selector: string) => {
            const element = host.querySelector(selector);
            if (!element) return null;
            const style = getComputedStyle(element);
            return { fontSize: style.fontSize, color: style.color };
          };
          return { point: read('.cee-fraction-separator'), colon: read('.cee-time-separator') };
        });

      expect(separators.colon, 'no clock separator to compare against').not.toBeNull();
      expect(separators.point, 'this fixture should hold a decimal-seconds field').not.toBeNull();
      expect(separators.point, 'the decimal point diverged from the colons in the same control').toEqual(
        separators.colon,
      );
    });

    /**
     * No placeholder in the row is shaped like a value.
     *
     * The decimal-seconds box used to read `000`, which is both a placeholder and a
     * valid value — and at this granularity the fraction is a *required* part, so an
     * empty box means the field records nothing. Date and time filled with a grey
     * `000` beside them therefore looked complete and stored `null`, while typing
     * `000` stored `…T02:30:15.000`. The two opposite states differed only in text
     * colour.
     *
     * Asserted as a rule about every placeholder rather than a check on one string,
     * because the next digit-shaped placeholder would be the same bug. The clock's
     * own `HH`/`MM`/`SS` already satisfy it, which is what made the fraction the
     * odd one out.
     *
     * A DOM assertion for the same reason as the separator above: changing `000` to
     * `sss` moved none of the 108 baselines, three grey glyphs being well under the
     * budget.
     */
    test('no placeholder in the temporal row can be mistaken for a value', async ({ page }) => {
      await open(page, '09-temporal');

      const placeholders = await page
        .locator('app-cedar-input-datetime')
        .filter({ has: page.locator('.cee-fraction-separator') })
        .first()
        .evaluate((host) =>
          [...host.querySelectorAll('input[placeholder]')].map((input) => (input as HTMLInputElement).placeholder),
        );

      expect(placeholders.length, 'expected the clock segments and the fraction box').toBeGreaterThan(1);
      const valueShaped = placeholders.filter((text) => /^[\d\s.:]+$/.test(text));
      expect(valueShaped, 'a placeholder made of digits is indistinguishable from data').toEqual([]);
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

  test('an out-of-range typed hour waits for blur, then restores instead of wrapping', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_minute');
    const hour = picker.locator('input[aria-label="Hour"]');

    await hour.fill('25');
    await expect(hour, 'do not interrupt while the user is still typing').toHaveValue('25');
    await expect(picker.getByRole('alert')).toHaveCount(0);
    expect(await storedValue(page, '_to_the_minute'), 'an invalid edit must never reach metadata').toBeNull();

    await hour.blur();
    await expect(hour, 'there was no previous value, so blur restores the empty field').toHaveValue('');
    await expect(picker.getByRole('alert')).toContainText('00 to 23');

    await hour.fill('14');
    await expect(picker.getByRole('alert'), 'a correction clears the feedback live').toHaveCount(0);
    await expect.poll(async () => String(await storedValue(page, '_to_the_minute'))).toContain('14:');
  });

  /** Wrapping rather than clamping when a focused segment is stepped. */
  test('stepping past the end of an hour wraps to the start', async ({ page }) => {
    await open(page, '09-temporal');
    const picker = pickerFor(page, 'to_the_minute');
    const hour = picker.locator('input[aria-label="Hour"]');
    await hour.fill('23');
    await page.waitForTimeout(200);

    await hour.press('ArrowUp');
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
    await minute.press('ArrowDown');
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
   * Guarded rather than eyeballed because a screenshot would report only that
   * pixels moved. The semantic failure is simpler: punctuation in a segmented
   * clock must share the digits' baseline and remain visible.
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

  test('read-only mode shows time in a non-editable outlined shell', async ({ page }) => {
    await open(page, '09-temporal', 'readonly');
    expect(await page.locator('input[aria-label="Hour"]').count()).toBe(0);
    const shells = page.locator('.cee-time-picker-readonly');
    expect(await shells.count()).toBeGreaterThan(0);

    const emptyShells = await shells.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          text: element.textContent?.trim(),
          width: box.width,
          height: box.height,
          borderStyle: style.borderStyle,
        };
      }),
    );
    for (const shell of emptyShells) {
      expect(shell.text, 'the fixture deliberately has no stored time').toBe('');
      expect(shell.width, 'an empty read-only time must remain visible').toBeGreaterThanOrEqual(64);
      expect(shell.height).toBeGreaterThanOrEqual(48);
      expect(shell.borderStyle).toBe('solid');
    }
  });

  test('one clear action removes every part of a temporal value', async ({ page }) => {
    await open(page, '21-temporal-normalization', undefined, '21-temporal-normalization-instance');
    const field = page.locator('app-cedar-input-datetime').nth(4); // time_fraction

    await field.getByRole('button', { name: 'Clear', exact: true }).click();

    await expect.poll(() => storedValue(page, '_time_fraction')).toBeNull();
    await expect(field.locator('input[aria-label="Hour"]')).toHaveValue('');
    await expect(field.locator('input[aria-label="Minute"]')).toHaveValue('');
    await expect(field.locator('input[aria-label="Second"]')).toHaveValue('');
    await expect(field.locator('input[aria-label="Select Decimal Seconds"]')).toHaveValue('');
  });
});

/**
 * Granularity is a storage rule, not only a decision about which boxes render.
 *
 * These values arrive with deliberately finer information. Loading the instance
 * must rewrite them to the neutral padding defined by the field's granularity,
 * while a decimal-second value keeps its exact fraction digits.
 */
test('normalizes existing temporal values to their declared granularity', async ({ page }) => {
  await open(page, '21-temporal-normalization', undefined, '21-temporal-normalization-instance');

  await expect
    .poll(() =>
      page
        .evaluate(() => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata)
        .then((metadata) => ({
          year: valueOf(metadata, '_date_year'),
          month: valueOf(metadata, '_date_month'),
          day: valueOf(metadata, '_datetime_day'),
          minute: valueOf(metadata, '_time_minute'),
          fraction: valueOf(metadata, '_time_fraction'),
        })),
    )
    .toEqual({
      year: '2026-01-01',
      month: '2026-08-01',
      day: '2026-08-09T00:00:00',
      minute: '21:45:00',
      fraction: '21:45:32.001',
    });

  const fields = page.locator('app-cedar-input-datetime');
  await expect(fields).toHaveCount(5);
  await expect(fields.nth(2).locator('app-date-picker'), 'dateTime/day keeps its date input').toHaveCount(1);
  await expect(fields.nth(2).locator('.cee-time-picker'), 'dateTime/day hides finer time input').toHaveCount(0);
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
   * none — there is no occurrence to show, and its pager says so in edit mode.
   * The fixture puts all three cases on one page in this order, and the
   * observable consequence is whether a content area exists inside each field
   * container.
   */
  test('a multi field renders its content only when it has something to show', async ({ page }) => {
    await open(page, '12-render-decision');

    const fields = page.locator('.non-iterable-component');
    await expect(fields, 'fixture should render three fields').toHaveCount(3);

    const expected = [
      ['list_no_values', 1, 'a list field is multi but not paged, so it always shows its content'],
      ['paged_no_instances', 0, 'paged with no instances: nothing to show, so no content area'],
      ['paged_one_instance', 1, 'paged with one instance: content shown'],
    ] as const;

    for (const [name, count, why] of expected) {
      const field = fields.nth(expected.findIndex((e) => e[0] === name));
      await expect(field.locator('app-cedar-component-header'), `field order changed: expected ${name}`).toContainText(
        name,
      );
      await expect(field.locator('.child-component-content'), `${name}: ${why}`).toHaveCount(count);
    }
  });

  test('read-only empty multi fields keep their specification label without editor-only instance messaging', async ({
    page,
  }) => {
    await open(page, '12-render-decision');

    const emptyEditableField = page.locator('.non-iterable-component').nth(1);
    await expect(emptyEditableField.locator('app-cedar-component-header')).toContainText('paged_no_instances');
    await expect(emptyEditableField).toContainText('No instances yet');

    await open(page, '12-render-decision', 'readonly');

    const emptyReadOnlyField = page.locator('.non-iterable-component').nth(1);
    await expect(emptyReadOnlyField.locator('app-cedar-component-header')).toContainText('paged_no_instances');
    await expect(emptyReadOnlyField).not.toContainText('No instances yet');
    await expect(emptyReadOnlyField.locator('mat-chip-listbox')).toHaveCount(0);
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
/**
 * The other half of the trust boundary: markup a *template* author wrote.
 *
 * `markup in an instance value` below asserts that instance-authored HTML is
 * sanitized. This asserts the same for template-authored HTML, which used to be
 * rendered verbatim on the strength of an assumption no embedder was told about —
 * that the host, not its users, chooses which template loads.
 *
 * Assertion-only, and `19-template-markup` is deliberately absent from `FIXTURES`:
 * its content is adversarial rather than representative, and a screenshot would
 * record what a sanitizer's output happens to look like rather than what it must
 * never do.
 */
/**
 * A configuration CEE cannot use is reported, not swallowed.
 *
 * The shipped declarations catch a misspelled key for a TypeScript host writing a
 * literal, and can say nothing about the two likelier routes in: a JavaScript host,
 * and `loadConfigFromURL`, whose JSON has been type-checked by nobody. Both used to
 * be answered with silence, and a key that is silently ignored looks exactly like
 * one that works.
 *
 * Driven through the real custom element rather than the validator directly —
 * `config-validation.spec.ts` covers the rules — because what is being asserted
 * here is that the check is *wired to the boundary* at all.
 */
test.describe('an unusable configuration', () => {
  const errorsWhileLoading = async (page: import('@playwright/test').Page, extra: string): Promise<string[]> => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('CEE ERROR')) {
        errors.push(message.text());
      }
    });
    await open(page, '01-input-types', undefined, undefined, undefined, extra);
    return errors;
  };

  test('names an unknown key and suggests the one meant', async ({ page }) => {
    const errors = await errorsWhileLoading(page, '&n=readOnlyMod');
    expect(errors.join('\n'), 'a misspelled key should be reported').toContain(
      'Unknown configuration key "readOnlyMod"',
    );
    expect(errors.join('\n'), 'and the near miss named').toContain('Did you mean "readOnlyMode"?');
  });

  test('says nothing about a configuration it can use', async ({ page }) => {
    const errors = await errorsWhileLoading(page, '&f=readOnlyMode');
    expect(errors.join('\n'), 'a valid configuration must not be reported').not.toContain('configuration key');
  });
});

test.describe('template rich text', () => {
  const shadowHtml = (page: import('@playwright/test').Page): Promise<string> =>
    page.evaluate(() => document.querySelector('cedar-embeddable-editor')!.shadowRoot!.innerHTML);

  test('cannot execute, and keeps its formatting, under the default policy', async ({ page }) => {
    await open(page, '19-template-markup');
    // The broken image has had time to fail, which is what would fire its handler.
    await page.waitForTimeout(500);

    const ran = await page.evaluate(() => (window as any).__templateMarkupRan === true);
    expect(ran, 'a handler from template rich text executed').toBe(false);

    const html = await shadowHtml(page);
    expect(html, 'an event handler survived sanitizing').not.toContain('onerror');
    expect(html, 'a javascript: URL survived sanitizing').not.toContain('javascript:');
    expect(html, 'an AngularJS directive survived sanitizing').not.toContain('ng-click');
    expect(html, 'an iframe survived sanitizing').not.toContain('<iframe');

    /*
     * The half that protects the feature rather than the origin. Angular's own
     * sanitizer would pass every assertion above and fail all of these, because it
     * has no `style` in its attribute allowlist — which is the entire reason this
     * field has a policy of its own.
     */
    expect(html, 'inline styles must survive: they are what rich text is for').toContain('rgb(12, 34, 56)');
    expect(html, 'font sizing must survive').toContain('font-size');
    expect(html, 'tables must survive').toContain('<table');
    expect(html, 'table attributes must survive').toContain('colspan');
    expect(html, 'lists must survive').toContain('<li');
    expect(html, 'inline data images must survive').toContain('data:image/png;base64');
    expect(html, 'safe links must survive').toContain('https://example.org/ok');
    expect(await page.locator('text=styled text').count(), 'the text itself must still render').toBeGreaterThan(0);
  });

  /**
   * `trustTemplateMarkup` renders the author's markup as written.
   *
   * Asserted through an attribute the policy would have removed rather than by
   * letting a handler fire: the proof needed is that the key reaches the pipe, and
   * an assertion that waits for a failed image load to run script is a slower and
   * flakier way to learn the same thing.
   */
  test('renders verbatim when the host asks for it by name', async ({ page }) => {
    await open(page, '19-template-markup', undefined, undefined, undefined, '&f=trustTemplateMarkup');

    const html = await shadowHtml(page);
    expect(html, 'trustTemplateMarkup did not reach the rich-text pipe').toContain('ng-click');
    expect(html, 'trusted markup should be verbatim').toContain('<iframe');
  });
});

/**
 * The rest of what a template author writes.
 *
 * Rich text is the only string rendered as HTML, so it is the only one with a
 * policy. Everything else an author controls reaches the page as interpolated text
 * or as a URL — a section break's label and help text, an image field's `src`, a
 * video field's link, and the messages the two resolvers produce when they refuse
 * one. Each is safe by a different mechanism, and each was a property of the code
 * that no test at render level held: the resolvers have unit coverage for hostile
 * input, which says what they return and nothing about what is drawn.
 *
 * `20-static-markup` is absent from `FIXTURES` for the same reason as
 * `19-template-markup`: a screenshot of a refusal records what a refusal happens to
 * look like.
 */
test.describe('template-authored strings that are not rich text', () => {
  const probes = (page: Page) =>
    page.evaluate(() => {
      const root = document.querySelector('cedar-embeddable-editor')!.shadowRoot!;
      return {
        html: root.innerHTML,
        heading: root.querySelector('.section-break-header')?.textContent ?? '',
        // An element carrying the attribute is one of the fixture's strings that
        // became markup. Counted page-wide, since a Material overlay can leave the
        // shadow root.
        becameMarkup: document.querySelectorAll('[data-static-markup]').length,
        images: root.querySelectorAll('img').length,
        frames: root.querySelectorAll('iframe').length,
      };
    });

  test('are shown as text, and never become markup or a URL the browser follows', async ({ page }) => {
    await open(page, '20-static-markup');
    // Long enough for the broken image to have failed, which is what would fire the
    // handler written into every one of these strings.
    await page.waitForTimeout(500);

    expect(
      await page.evaluate(() => (window as any).__staticMarkupRan === true),
      'a handler from a template-authored string executed',
    ).toBe(false);

    const { html, heading, becameMarkup, images, frames } = await probes(page);
    expect(becameMarkup, 'a template-authored string was parsed as markup').toBe(0);
    expect(images, 'an image element was built from a URL that cannot address an image').toBe(0);
    expect(frames, 'an iframe was built from a host that merely ends in the YouTube one').toBe(0);

    // The other half: refusing to render it must not amount to hiding it. An author
    // fixes what they can see, so the label reads back exactly as it was typed.
    expect(heading, 'the section-break label should render as the text it is').toContain(
      'onerror="window.__staticMarkupRan = true"',
    );

    expect(html, 'the javascript: image URL should be refused by scheme').toContain('cannot address an image');
    expect(html, 'the data: image URL should be refused for not carrying an image').toContain('other than an image');
    expect(html, 'the lookalike host should be named').toContain('youtube.com.evil.example');
    expect(html, 'and refused as a video').toContain('only YouTube videos can be embedded');
    expect(html, 'a rejected data: URL should be named by media type, not quoted whole').not.toContain('PHNjcmlwdD');
  });

  /**
   * The section break's help text is the one string here that is not in the page
   * until it is asked for. It reaches the reader twice — as the tooltip Material
   * shows on hover, and as the hidden element `aria-describedby` points at — so
   * both are checked, the second because a screen reader is the only route to it.
   */
  test('reach the help tooltip as text too', async ({ page }) => {
    await open(page, '20-static-markup');

    const described = page.locator('[id^="cdk-describedby-message"]').first();
    await expect(described).toContainText('onerror="window.__staticMarkupRan = true"');

    await page.locator('mat-icon.icon-help').first().hover();
    const tooltip = page.locator('.mat-mdc-tooltip-surface').first();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('onerror="window.__staticMarkupRan = true"');

    const { becameMarkup } = await probes(page);
    expect(becameMarkup, 'the help text was parsed as markup').toBe(0);
  });
});

/**
 * An attribute-value field the instance says nothing about.
 *
 * A template declares the property and an instance need not carry a slot for it, so
 * a field nobody has filled in arrives with no node at that path at all. CEE treated
 * that as data missing rather than as an unfilled field: the pager reported it from
 * `ngDoCheck`, once per change-detection pass for as long as the form stayed open,
 * and the add button had no list to splice into and turned the click away without
 * anything reaching the screen.
 *
 * Driven through the real element rather than the handlers, because what broke was
 * the whole path from the loaded document to the button — the handler tests would
 * have passed on an instance built with the slot already there.
 */
test.describe('an attribute-value field with no slot in the instance', () => {
  const ceeErrors = (page: Page): string[] => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('CEE ERROR')) {
        errors.push(message.text());
      }
    });
    return errors;
  };

  const attributeRows = (page: Page): Promise<number> =>
    page.evaluate(
      () =>
        document
          .querySelector('cedar-embeddable-editor')!
          .shadowRoot!.querySelectorAll('app-cedar-input-attribute-value').length,
    );

  test('loads without reporting the absent slot as an error', async ({ page }) => {
    const errors = ceeErrors(page);
    await open(page, '10-attribute-values', undefined, '10-attribute-values-unfilled-instance');
    // `ngDoCheck` runs on every pass, so a report would arrive repeatedly rather than
    // once — long enough here for more than one.
    await page.waitForTimeout(500);

    expect(errors.join('\n'), 'an unfilled attribute-value field is not a missing instance').not.toContain(
      'data in instance',
    );
  });

  test('adds an attribute when asked, having had nowhere to add one', async ({ page }) => {
    const errors = ceeErrors(page);
    await open(page, '10-attribute-values', undefined, '10-attribute-values-unfilled-instance');

    expect(await attributeRows(page), 'the field starts with no attributes').toBe(0);

    await page.getByRole('button', { name: 'Add empty after current' }).first().click();

    await expect
      .poll(() => attributeRows(page), { message: 'clicking add should produce an attribute row' })
      .toBe(1);
    await expect(page.getByRole('textbox', { name: 'Attribute Name' }).first()).toBeVisible();
    expect(errors.join('\n'), 'adding should raise nothing').not.toContain('data in instance');
  });
});

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

  /**
   * REGRESSION, and the reason this is parameterised.
   *
   * Clicking a suggestion blurs the input, and the blur arrives before Material
   * reports the selection — so a blur handler that reconciles immediately reads
   * no selection, decides the typed text names no term, and clears the value
   * being chosen. It emptied the box and pushed null to the host on 7 of 24
   * clicks.
   *
   * It went unfixed for a long time because this assertion covered PFAS alone
   * while the defect sat in the base class behind five widgets, so it read as
   * one flaky test rather than a bug in all of them. The blur assertion beside
   * it has always run over every authority; this one now does too. ORCID and ROR
   * used to carry their own copies of the flow, kept for the record panels they
   * alone had; with the panels gone all seven run the same base class, and this
   * loop is what holds them to it.
   */
  for (const { label: fieldName, authority, name } of [
    { label: 'contributor_orcid', authority: 'orcid', name: 'ORCID' },
    { label: 'institution_ror', authority: 'ror', name: 'ROR' },
    { label: 'chemical_pfas', authority: 'pfas', name: 'PFAS' },
    { label: 'citation_pmid', authority: 'pmid', name: 'PubMed' },
    { label: 'resource_rrid', authority: 'rrid', name: 'RRID' },
    { label: 'award_nih', authority: 'nihGrant', name: 'NIH Grant' },
    { label: 'dataset_doi', authority: 'doi', name: 'DOI' },
  ] as const) {
    test(`${name}: a returned term can be selected and reaches the host metadata`, async ({ page }) => {
      const id = `https://example.org/${authority}/DETERMINISTIC-1`;
      const label = `Deterministic ${name} result`;
      await page.route(`**/authority/${authority}/search**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ found: true, results: { [id]: { name: label } } }),
        });
      });

      await open(page, '08-authority', 'authority');
      const field = page.locator(`input[aria-label="${fieldName}"]`);
      await field.pressSequentially('deterministic', { delay: 40 });
      await passDebounceWindow(page);
      const option = page.locator('mat-option').filter({ hasText: label });
      await expect(option, 'the authority response did not become a selectable option').toBeVisible({ timeout: 5000 });
      await option.click();

      await expect(field, 'clicking a suggestion must not clear the field it selects').toHaveValue(`${label} - ${id}`);
      const metadata = await page.evaluate(
        () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
      );
      expect(JSON.stringify(metadata), 'the selected authority term did not reach currentMetadata').toContain(id);
      expect(JSON.stringify(metadata)).toContain(label);

      /*
       * What the suffix control says it does, now there is a value for it to act
       * on. Every one of them read "Show Details" — which named no subject and did
       * not say where it went. The accessible name disagreed with the tooltip and
       * was untranslated English.
       *
       * All seven are links out now. ORCID and ROR used to expand a record panel in
       * place instead, and said "show" rather than "open"; the panels are gone, so
       * the branch that distinguished them is gone with them and this asserts one
       * rule over the whole set. Both strings are asserted to be the same one so
       * they cannot drift apart again.
       */
      const expected = `Open the ${name} page`;
      const suffix = page
        .locator('mat-form-field')
        .filter({ has: page.locator(`input[aria-label="${fieldName}"]`) })
        .locator('a[mat-icon-button]')
        .first();

      await expect(suffix, 'the record control names its authority').toHaveAttribute('aria-label', expected);
      await suffix.hover();
      await expect(
        page.locator('.mat-mdc-tooltip-surface'),
        'the tooltip and the accessible name are the same string',
      ).toHaveText(expected);
    });
  }
});

test.describe('controlled terminology selection', () => {
  test('a returned term can be selected and reaches the host metadata', async ({ page }) => {
    const id = 'http://purl.obolibrary.org/obo/NCBITaxon_9606';
    const label = 'Homo sapiens';
    await page.route('http://127.0.0.1:9/unused', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        // The terminology server's own wire keys, which is what CEE reads at that
        // boundary — `id` is a short identifier there and the IRI is under `@id`.
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

  /**
   * What a chosen term looks like, which is where the two families disagreed.
   *
   * Choosing one used to swap the widget for a bordered `div` whose whole value
   * was a hyperlink — the only value text in CEE that was one, so a controlled
   * term read as clickable while the ORCID beside it did not. It also cost the
   * field its Clear action and any way back to the search box.
   *
   * No baseline covered this: the substitute only appeared once a term had been
   * chosen, and every screenshot of this fixture is of an empty form. Replacing
   * it changed no pixel any baseline holds, which is the reason for asserting the
   * shape here rather than trusting the suite to have noticed.
   */
  test('a chosen term keeps its field, and offers BioPortal as a suffix link', async ({ page }) => {
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
    const widget = page.locator('app-cedar-input-controlled').filter({
      has: page.locator('input[aria-label="organism"]'),
    });
    await widget.locator('input').pressSequentially('Homo', { delay: 40 });
    await passDebounceWindow(page);
    await page.locator('mat-option').filter({ hasText: label }).click();
    await page.waitForTimeout(300);

    await expect(widget.locator('.fake-input'), 'the imitation field is gone').toHaveCount(0);
    await expect(widget.locator('mat-form-field'), 'a chosen term stays in a real form field').toHaveCount(1);
    await expect(widget.locator('input')).toHaveValue(label);

    // The value is text, not a link. Nothing inside the field's own box is an
    // anchor except the suffix action.
    const link = widget.locator('a[mat-icon-button]');
    await expect(link, 'the BioPortal record is one suffix action').toHaveCount(1);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
    // The ontology constraint decides the path: NCBITAXON, under the configured prefix.
    await expect(link).toHaveAttribute(
      'href',
      `https://bioportal.bioontology.org/ontologies/NCBITAXON?p=classes&conceptid=${encodeURIComponent(id)}`,
    );

    await expect(
      widget.getByRole('button', { name: 'Clear', exact: true }),
      'clearing a chosen term used to be impossible',
    ).toHaveCount(1);
  });

  /**
   * REGRESSION: this widget searches BioPortal rather than an authority, and had
   * no blur handling at all — so text naming no term simply stayed in the box
   * over an instance holding nothing. It is the same defect the seven authority
   * widgets were fixed for, and this one was never part of that pass. Measured
   * before the fix: `zzz nonsense` left in the field, no message, empty
   * instance.
   */
  test('free text is discarded on blur, and said so', async ({ page }) => {
    await open(page, '04-controlled-terms');

    const field = page.locator('input[aria-label="organism"]');
    await field.pressSequentially('zzz nonsense', { delay: 15 });
    await page.waitForTimeout(500);
    await field.blur();
    await page.waitForTimeout(600);

    await expect(field, 'text naming no term cannot be saved, so it must not linger').toHaveValue('');
    await expect(page.locator('mat-error')).toHaveCount(1);
    await expect(page.locator('.input-warning')).toHaveCount(1);
    const metadata = await page.evaluate(
      () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
    );
    expect(JSON.stringify(metadata), 'discarded text must not reach the instance').not.toContain('nonsense');
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
    await page.evaluate((node) => {
      const cee = document.querySelector('cedar-embeddable-editor') as any;
      const replacement = structuredClone(cee.currentMetadata);
      replacement._access = node;
      cee.instanceObject = replacement;
    }, literalNode('Public'));

    await expect(page.getByRole('radio', { checked: true })).toHaveAccessibleName('Public');
    await expect(async () => {
      const metadata = await page.evaluate(
        () => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata,
      );
      expect(valueOf(metadata, '_access')).toBe('Public');
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
 * Each date picker provides its own DateTimeService, writes its own `dateFormat`
 * into it, and CustomDateAdapter formats the native Date from that local value.
 * The test protects that component boundary: a year field must not inherit the
 * day format from another picker on the same page.
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
 * Date, clock, fraction, offset and clear are separate components, but they are
 * perceived as one temporal control. Material gives a date field a 48px row as
 * soon as its calendar action is present, while CEE's compact fields otherwise
 * settle at 36px. Guard the shared action-row height so the pieces cannot drift
 * back into the stepped baseline seen in the filled migration template.
 */
test('temporal controls share one action-row height and wide-screen baseline', async ({ page }, testInfo) => {
  await open(page, '07-timezone');

  const composed = await page.evaluate(() => {
    const field = document
      .querySelector('cedar-embeddable-editor')!
      .shadowRoot!.querySelector('app-cedar-input-datetime')!;
    const boxes = [
      field.querySelector('.cee-temporal-date mat-form-field'),
      field.querySelector('.cee-time-input-shell'),
      field.querySelector('.cee-temporal-offset mat-form-field'),
    ].map((element) => {
      const rect = element!.getBoundingClientRect();
      return { height: rect.height, top: rect.top };
    });
    return boxes;
  });

  for (const box of composed) {
    expect(box.height, 'every visible temporal control uses the Material action-row height').toBeCloseTo(48, 0);
  }
  if (testInfo.project.name === 'desktop') {
    expect(Math.max(...composed.map(({ top }) => top)) - Math.min(...composed.map(({ top }) => top))).toBeLessThan(1);
  }

  await open(page, '21-temporal-normalization', undefined, '21-temporal-normalization-instance');
  const filled = await page.evaluate(() => {
    const fields = document
      .querySelector('cedar-embeddable-editor')!
      .shadowRoot!.querySelectorAll('app-cedar-input-datetime');
    const measure = (element: Element | null) => {
      const rect = element!.getBoundingClientRect();
      return { height: rect.height, top: rect.top };
    };
    return {
      date: [
        measure(fields[0].querySelector('mat-form-field')),
        measure(fields[0].querySelector('.cee-temporal-clear')),
      ],
      fractionalTime: [
        measure(fields[4].querySelector('.cee-time-input-shell')),
        measure(fields[4].querySelector('.cee-fraction-field')),
        measure(fields[4].querySelector('.cee-temporal-clear')),
      ],
    };
  });

  for (const box of [...filled.date, ...filled.fractionalTime]) {
    expect(box.height).toBeCloseTo(48, 0);
  }
  if (testInfo.project.name === 'desktop') {
    for (const row of [filled.date, filled.fractionalTime]) {
      expect(Math.max(...row.map(({ top }) => top)) - Math.min(...row.map(({ top }) => top))).toBeLessThan(1);
    }
  }
});

test('temporal input text and boundaries meet WCAG 2.2 AA contrast', async ({ page }) => {
  await open(page, '09-temporal');

  const colors = await page.evaluate(() => {
    const root = document.querySelector('cedar-embeddable-editor')!.shadowRoot!;
    const shell = root.querySelector('.cee-time-input-shell')!;
    const input = shell.querySelector('input')!;
    return {
      background: getComputedStyle(shell).backgroundColor,
      border: getComputedStyle(shell).borderTopColor,
      text: getComputedStyle(input).color,
      placeholder: getComputedStyle(input, '::placeholder').color,
    };
  });

  const channels = (color: string): number[] =>
    color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number);
  const luminance = (color: string): number => {
    const linear = channels(color).map((channel) => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (foreground: string, background: string): number => {
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  };

  expect(contrast(colors.text, colors.background), 'entered time text needs 4.5:1 contrast').toBeGreaterThanOrEqual(
    4.5,
  );
  expect(
    contrast(colors.placeholder, colors.background),
    'time placeholders need 4.5:1 contrast',
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrast(colors.border, colors.background),
    'the time control boundary needs 3:1 contrast',
  ).toBeGreaterThanOrEqual(3);
});

/**
 * The date picker boundary uses native `Date` values now, but CEE's public value
 * remains the XSD lexical form dictated by the template granularity. Exercise
 * the Material calendar itself so a display-only success cannot hide a broken
 * selection event or an accidental local-date conversion.
 */
test.describe('date calendar selection', () => {
  const storedValue = async (page: import('@playwright/test').Page, field: string): Promise<unknown> =>
    valueOf(
      await page.evaluate(() => (document.querySelector('cedar-embeddable-editor') as any).currentMetadata),
      field,
    );

  const openCalendar = async (input: import('@playwright/test').Locator): Promise<void> => {
    await input.locator('xpath=ancestor::mat-form-field').locator('.mat-datepicker-toggle button').click();
  };

  const chooseCell = async (page: import('@playwright/test').Page, accessibleName: string): Promise<void> => {
    await page.getByRole('dialog').getByRole('button', { name: accessibleName, exact: true }).click();
  };

  test('year selection stores January 1 at year granularity', async ({ page }) => {
    await open(page, '09-temporal');
    const year = page.locator('input[aria-label="Select Year"]').first();

    await openCalendar(year);
    await chooseCell(page, '2030');

    await expect(year).toHaveValue('2030');
    await expect.poll(() => storedValue(page, '_year_only')).toBe('2030-01-01');
  });

  test('month selection stores the first day at month granularity', async ({ page }) => {
    await open(page, '21-temporal-normalization', undefined, '21-temporal-normalization-instance');
    const month = page.locator('input[aria-label="Select Year and Month"]').first();

    await openCalendar(month);
    await chooseCell(page, '2030');
    await chooseCell(page, '08/2030');

    await expect(month).toHaveValue('08/2030');
    await expect.poll(() => storedValue(page, '_date_month')).toBe('2030-08-01');
  });

  test('day selection stores exactly the selected local calendar day', async ({ page }) => {
    await open(page, '09-temporal', undefined, '15-date-formats-instance');
    const day = page.locator('input[aria-label="Select Date"]').first();

    await openCalendar(day);
    await chooseCell(page, '03/15/2026');

    await expect(day).toHaveValue('03/15/2026');
    await expect.poll(() => storedValue(page, '_day_only')).toBe('2026-03-15');
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
