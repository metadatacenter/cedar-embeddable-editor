import { expect, test, type APIResponse, type Locator, type Page } from '@playwright/test';
import {
  VIEWPORTS,
  check,
  settle,
  type Exception,
  type LayoutCheck,
  type ReflowRequest,
  type ResizeRequest,
  type SpacingRequest,
} from './layout-resilience.generated.mjs';
import { open, passDebounceWindow } from './support/host';
import { fieldBox } from './support/field-box';

/**
 * Whether CEE's content survives a narrow host, a zoomed window and wider text, and whether its
 * placeholders, field boundaries, icons, focus indicators and selection marks can be seen.
 *
 * The checks are the shared ones the token package generates into `layout-resilience.generated.mjs`,
 * which say what WCAG asks and how each is measured. This spec reaches CEE's states and records what
 * CEE excuses. A finding fails the test unless `EXCEPTIONS` lists it with the visible change it needs,
 * and a listed finding that no longer occurs fails too, so the list cannot outlive what it describes.
 *
 * Each check runs over the input types, choices, authority and temporal fixtures, a nested one and a
 * multi-page one, editable and read only, and over the field element showing one field of each of
 * the first four. It also runs over the input types, controlled terms and authority fixtures read
 * only, each box holding a value too long for one line. Reflow, resize and text spacing also run
 * over a form with each kind of overlay open: the date picker's calendar in its month and multi-year
 * views, a select's panel, a multi-select's panel with a long option, the time zone select's panel,
 * an autocomplete's suggestions, a term lookup's suggestions and its failure notice, the download
 * menu, and a field's description and property IRI tooltips.
 */

/** The CEE hosts on the page. Every check measures within them. */
const SCOPE = 'cedar-embeddable-editor, cedar-embeddable-field';

/** An open overlay's pane covers the form on purpose, and a control beneath it is reached by closing it. */
const OVERLAYS: readonly string[] = ['.cdk-overlay-pane'];

/** Findings that wait on a visible change. None waits now. */
const EXCEPTIONS: readonly Exception[] = [];

/** The three layout checks, each with the words its test titles use. */
const LAYOUT_CHECKS: readonly (readonly [LayoutCheck, string])[] = [
  ['reflow', 'reflows at 320 CSS px'],
  ['resize', 'fits the viewport proxy for 200% zoom'],
  ['spacing', 'keeps its text whole under WCAG text spacing'],
];

/** A layout check of `state`. Reflow and resize also test reach, so their requests name CEE's overlays. */
const layoutRequest = (layout: LayoutCheck, state: string): ReflowRequest | ResizeRequest | SpacingRequest =>
  layout === 'spacing'
    ? { check: layout, state, scope: SCOPE, exceptions: EXCEPTIONS }
    : { check: layout, state, scope: SCOPE, overlays: OVERLAYS, exceptions: EXCEPTIONS };

/**
 * The state whose boundary and indicator checks must measure something. A selector that stopped
 * matching would otherwise let them pass by measuring nothing.
 */
const MEASURED = '01-input-types editable';

const FIXTURES = ['01-input-types', '02-choices', '08-authority', '09-temporal', '03-nested-multi', '05-static-paged'];

/** Read only, a fixture shows the instance written for it where it has one. */
const INSTANCES: Readonly<Record<string, string>> = {
  '01-input-types': '01-input-types-instance',
  '02-choices': '02-choices-selected-instance',
  '08-authority': '08-authority-instance',
};

const MODES = ['editable', 'read only'] as const;
type Mode = (typeof MODES)[number];

const show = (page: Page, fixture: string, mode: Mode): Promise<void> =>
  mode === 'editable' ? open(page, fixture) : open(page, fixture, 'readonly', INSTANCES[fixture]);

/** The field the field element shows from each of the input types, choices, authority and temporal fixtures. */
const FIELDS = [
  ['01-input-types', '_text'],
  ['02-choices', '_radio'],
  ['08-authority', '_contributor_orcid'],
  ['09-temporal', '_decimal_seconds'],
] as const;

/** Text long enough to wrap in any box CEE draws, with a word too long for a line at 320 CSS px. */
const LONG_TEXT =
  'A value written at length, the way a curator describes a sample when the form leaves room for it: ' +
  'where it was collected, how it was stored and who handled it, ending with an identifier ' +
  'urn:example:sample:2026-10-21:freezer-04:rack-11:box-07:position-63.';

/** A fixture as Playwright parses it, which a change reaches into by the keys it knows. */
type Parsed = Awaited<ReturnType<APIResponse['json']>>;

/** Serve a fixture changed by `change`, which is given the parsed JSON. */
const serveChanged = async (page: Page, fixture: string, change: (json: Parsed) => void): Promise<void> => {
  await page.route(`**/fixtures/${fixture}.json`, async (route) => {
    const json = await (await route.fetch()).json();
    change(json);
    await route.fulfill({ json });
  });
};

/** The field route reports ready before the field renders, so this waits for the field and its fonts. */
const showField = async (page: Page, fixture: string, property: string, mode: Mode): Promise<void> => {
  await open(
    page,
    fixture,
    mode === 'editable' ? undefined : 'readonly',
    undefined,
    undefined,
    `&host=field&p=${property}`,
  );
  await expect(page.locator('cedar-embeddable-field app-cedar-field-widget').first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await settle(page);
};

/**
 * Every check over the state `reach` puts on the page, each in the viewport its check measures in.
 * `after` runs once a layout check has passed, on the page as the check left it.
 */
const checkState = (
  state: string,
  reach: (page: Page) => Promise<void>,
  after?: (page: Page, layout: LayoutCheck) => Promise<void>,
): void => {
  for (const [layout, title] of LAYOUT_CHECKS)
    test(`${state} ${title}`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[layout]);
      await reach(page);
      await check(page, expect, layoutRequest(layout, state));
      await after?.(page, layout);
    });

  test(`${state} placeholders clear 4.5:1`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.placeholder);
    await reach(page);
    await check(page, expect, { check: 'placeholder', state, scope: SCOPE, exceptions: EXCEPTIONS });
  });

  test(`${state} field boundaries clear 3:1`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.boundary);
    await reach(page);
    const { measured } = await check(page, expect, {
      check: 'boundary',
      state,
      scope: SCOPE,
      exceptions: EXCEPTIONS,
    });
    if (state === MEASURED) expect(measured.boundary, 'controls that draw a boundary').toBeGreaterThan(0);
  });

  test(`${state} icons, focus indicators and selection marks clear 3:1`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.indicators);
    await reach(page);
    const { measured } = await check(page, expect, {
      check: 'indicators',
      state,
      scope: SCOPE,
      exceptions: EXCEPTIONS,
    });
    if (state === MEASURED) {
      expect(measured.icon, 'icons').toBeGreaterThan(0);
      expect(measured.focus, 'focus indicators').toBeGreaterThan(0);
    }
  });
};

for (const fixture of FIXTURES)
  for (const mode of MODES) checkState(`${fixture} ${mode}`, (page) => show(page, fixture, mode));

for (const [fixture, property] of FIELDS)
  for (const mode of MODES)
    checkState(`the field element showing ${fixture} ${property} ${mode}`, (page) =>
      showField(page, fixture, property, mode),
    );

/**
 * Read only, a fixture shows the instance written for it, with a value in each box long enough to need
 * more than one line at 320 CSS px. Most of them need more than one at 1280.
 */
const LONG_VALUES: readonly { fixture: string; instance: string; values: Readonly<Record<string, unknown>> }[] = [
  {
    fixture: '01-input-types',
    instance: '01-input-types-instance',
    values: {
      _text: { '@value': LONG_TEXT },
      _textarea: { '@value': LONG_TEXT },
      _email: { '@value': 'the.curator.who.collected.this.sample@a-departmental-subdomain.example.org' },
      _phone: { '@value': '+1 650 555 0100 555 0100 555 0100 555 0100' },
      _link: { '@id': 'https://example.org/samples/2026-10-21/freezer-04/rack-11/box-07/position-63/record' },
    },
  },
  {
    fixture: '04-controlled-terms',
    instance: '04-controlled-terms-instance',
    values: {
      _organism: {
        '@id': 'http://purl.obolibrary.org/obo/NCBITaxon_63221',
        'rdfs:label': 'Homo neanderthalensis, the Neanderthal, known from remains across Europe and western Asia',
      },
      _contributor: {
        '@id': 'https://orcid.org/0000-0002-1825-0097',
        'rdfs:label': 'Josiah Stinkney Carberry, Professor of Psychoceramics, Brown University',
      },
      _institution: [
        {
          '@id': 'https://ror.org/00f54p054',
          'rdfs:label': 'The Board of Trustees of the Leland Stanford Junior University',
        },
        { '@id': 'https://ror.org/013meh722', 'rdfs:label': 'The Chancellor, Masters, and Scholars of Cambridge' },
      ],
    },
  },
  {
    fixture: '08-authority',
    instance: '08-authority-instance',
    values: {
      _contributor_orcid: {
        '@id': 'https://orcid.org/0000-0002-1825-0097',
        'rdfs:label': 'Josiah Stinkney Carberry, Professor of Psychoceramics, Brown University',
      },
      _institution_ror: {
        '@id': 'https://ror.org/00f54p054',
        'rdfs:label': 'The Board of Trustees of the Leland Stanford Junior University',
      },
    },
  },
];

/**
 * Read only, a text, email or phone value is drawn in the box a paragraph grows in. A value too long
 * for one line wraps onto further lines, and the box shows all of them without scrolling. Each value
 * is too long for one line at 320 CSS px, and the sentence is too long at every width.
 *
 * The spacing check leaves WCAG's spacing on the page, so after it the boxes are measured spaced. The
 * line height confirms it.
 */
const wrapsWhole = async (page: Page, layout: LayoutCheck): Promise<void> => {
  for (const label of ['text', 'email', 'phone']) {
    const box = fieldBox(page, label, 'textarea');
    await expect(box).toHaveJSProperty('readOnly', true);
    const shown = await box.evaluate((textarea: HTMLTextAreaElement) => {
      const style = getComputedStyle(textarea);
      const line = document.createElement('span');
      for (const property of ['font', 'letter-spacing', 'word-spacing'])
        line.style.setProperty(property, style.getPropertyValue(property));
      Object.assign(line.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' });
      line.textContent = textarea.value;
      textarea.parentElement!.appendChild(line);
      const needed = line.getBoundingClientRect().width;
      line.remove();
      return {
        lineHeight: parseFloat(style.lineHeight) / parseFloat(style.fontSize),
        lines: Math.round(textarea.clientHeight / parseFloat(style.lineHeight)),
        wraps: needed > textarea.clientWidth + 1,
        hidden: {
          down: textarea.scrollHeight - textarea.clientHeight,
          across: textarea.scrollWidth - textarea.clientWidth,
        },
      };
    });
    if (layout === 'spacing') expect(shown.lineHeight, `${label}: WCAG's line height applies`).toBeCloseTo(1.5);
    expect(shown.hidden, `${label}: the box shows its whole value`).toEqual({ down: 0, across: 0 });
    if (shown.wraps) expect(shown.lines, `${label}: a value too long for one line takes more`).toBeGreaterThan(1);
    else expect(shown.lines, `${label}: a value that fits takes one line`).toBe(1);
  }
  const lines = (label: string) =>
    fieldBox(page, label, 'textarea').evaluate((textarea) =>
      Math.round(textarea.clientHeight / parseFloat(getComputedStyle(textarea).lineHeight)),
    );
  expect(await lines('text')).toBeGreaterThan(1);
  if (layout === 'reflow') {
    expect(await lines('email')).toBeGreaterThan(1);
    expect(await lines('phone')).toBeGreaterThan(1);
  }
};

for (const [index, { fixture, instance, values }] of LONG_VALUES.entries())
  checkState(
    `${fixture} read only with values too long for one line`,
    async (page) => {
      await serveChanged(page, instance, (json) => Object.assign(json, values));
      await open(page, fixture, 'readonly', instance);
    },
    index === 0 ? wrapsWhole : undefined,
  );

/**
 * An address with no break opportunity, as a DOI often ends a description. It has no hyphen, after
 * which a line may break, and set in body text it is wider than the page at 320 CSS px. An embedding
 * host's preview at that width scrolled sideways for one.
 */
const UNBROKEN = 'https://doi.org/10.5061/dryad.2rbnzs7v7xq8b4kfzwm3c8d9e0x';

/**
 * The prose CEE draws from a template: the template's description, a rich-text field and, read only,
 * a field's description. Each must hold the address within its own box and within the page.
 */
const proseWraps = async (page: Page, mode: Mode): Promise<void> => {
  const prose = [
    page.locator('.template-description').first(),
    page.locator('app-cedar-static-rich-text'),
    ...(mode === 'read only' ? [page.locator('.cee-field-spec-description', { hasText: UNBROKEN })] : []),
  ];
  for (const block of prose) {
    await expect(block).toContainText(UNBROKEN);
    const fit = await block.evaluate((element) => ({
      overflow: element.scrollWidth - element.clientWidth,
      right: element.getBoundingClientRect().right - document.documentElement.clientWidth,
    }));
    expect(fit.overflow, 'the address stays within its block').toBeLessThanOrEqual(1);
    expect(fit.right, 'the block stays within the page').toBeLessThanOrEqual(0);
  }
};

for (const mode of MODES)
  checkState(
    `05-static-paged ${mode} with an unbroken address ending its prose`,
    async (page) => {
      await serveChanged(page, '05-static-paged', (template) => {
        template['schema:description'] = `Static content and page breaks, cited as ${UNBROKEN}`;
        template._ui.propertyDescriptions._first = `Cite the dataset as ${UNBROKEN}`;
        template.properties._note._ui._content = `<p>Some <strong>rich</strong> guidance text from ${UNBROKEN}</p>`;
      });
      await open(
        page,
        '05-static-paged',
        mode === 'editable' ? undefined : 'readonly',
        undefined,
        undefined,
        '&f=showTemplateDescription',
      );
    },
    (page) => proseWraps(page, mode),
  );

/**
 * At 320 CSS px a nested element's header is narrower than its name. The name shrinks and ends in an
 * ellipsis, and the chevron and both marks stay whole inside the header, in their order. The header
 * used to keep the name whole and clip the property mark off its end.
 */
test("a nested element's header too narrow for its name ends the name in an ellipsis and keeps its marks in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, '03-nested-multi');
  await settle(page);
  const heading = await page.evaluate(() => {
    const root = document.querySelector('cedar-embeddable-editor')!.shadowRoot!;
    const panel = [...root.querySelectorAll('mat-expansion-panel')].find((candidate) =>
      candidate
        .querySelector(':scope > mat-expansion-panel-header .title-label')
        ?.textContent?.trim()
        .startsWith('affiliation'),
    )!;
    const header = panel.querySelector(':scope > mat-expansion-panel-header')!;
    const label = header.querySelector('.title-label')!;
    const text = document.createRange();
    text.selectNodeContents(label);
    const box = (element: Element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    return {
      ellipsis: getComputedStyle(label).textOverflow,
      textWidth: text.getBoundingClientRect().width,
      labelWidth: label.getBoundingClientRect().width,
      // The header's content box, which clips what passes it.
      clip: box(header.querySelector('.mat-content')!),
      chevron: box(header.querySelector('[data-disclosure]')!),
      marks: [...panel.querySelectorAll(':scope > app-cedar-component-marks > *')].map(box),
    };
  });
  expect(heading.ellipsis).toBe('ellipsis');
  expect(heading.textWidth, 'the name is shortened').toBeGreaterThan(heading.labelWidth + 1);
  expect(heading.marks).toHaveLength(2);
  for (const [name, part] of [
    ['chevron', heading.chevron],
    ['help mark', heading.marks[0]],
    ['property mark', heading.marks[1]],
  ] as const) {
    expect(part.left, `${name} starts inside the header`).toBeGreaterThanOrEqual(heading.clip.left - 0.5);
    expect(part.right, `${name} ends inside the header`).toBeLessThanOrEqual(heading.clip.right + 0.5);
    expect(part.top, `${name} is inside the header`).toBeGreaterThanOrEqual(heading.clip.top - 0.5);
    expect(part.bottom, `${name} is inside the header`).toBeLessThanOrEqual(heading.clip.bottom + 0.5);
  }
  expect(heading.chevron.right).toBeLessThanOrEqual(heading.marks[0].left);
  expect(heading.marks[0].right).toBeLessThanOrEqual(heading.marks[1].left);
});

/** The panel header of the element whose name starts with `name`. */
const elementHeader = (page: Page, name: string): Locator =>
  page
    .locator('mat-expansion-panel-header')
    .filter({ has: page.locator('.title-label', { hasText: new RegExp(`^\\s*${name}\\b`) }) });

/** The tooltips on screen showing exactly `text`. */
const tooltipOf = (page: Page, text: string): Locator =>
  page.locator('.mat-mdc-tooltip-surface').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });

/** Keyboard focus on an element's header, reached back from its help mark, which follows it. */
const focusFromKeyboard = async (page: Page, header: Locator): Promise<void> => {
  await header
    .locator('xpath=..')
    .locator(':scope > app-cedar-component-marks')
    .getByRole('img', { name: 'Description', exact: true })
    .focus();
  await page.keyboard.press('Shift+Tab');
  await expect(header).toBeFocused();
};

/**
 * A header that shortens an element's name shows the whole name in a tooltip, on hover and on
 * keyboard focus. A header whose name fits shows none, and the tooltip follows the header as the
 * window narrows and widens.
 */
test('a shortened element name shows in full in a tooltip on hover and on keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, '03-nested-multi');
  await settle(page);
  const header = elementHeader(page, 'affiliation');
  await expect(header).not.toHaveClass(/mat-mdc-tooltip-disabled/);

  await header.locator('.title-label').hover();
  await expect(tooltipOf(page, 'affiliation')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(tooltipOf(page, 'affiliation')).toHaveCount(0);

  await focusFromKeyboard(page, header);
  await expect(tooltipOf(page, 'affiliation')).toBeVisible();
});

test('an element name that fits its header shows no tooltip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '03-nested-multi');
  await settle(page);
  for (const name of ['author', 'affiliation']) {
    const header = elementHeader(page, name);
    await expect(header).toHaveClass(/mat-mdc-tooltip-disabled/);
    await header.locator('.title-label').hover();
    await focusFromKeyboard(page, header);
  }
  // Long enough for a tooltip that was going to open to have opened.
  await page.waitForTimeout(500);
  await expect(page.locator('.mat-mdc-tooltip-surface')).toHaveCount(0);
});

test('an element name shortened by a narrower window shows its tooltip, and drops it once it fits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '03-nested-multi');
  await settle(page);
  const header = elementHeader(page, 'affiliation');
  await expect(header).toHaveClass(/mat-mdc-tooltip-disabled/);

  await page.setViewportSize({ width: 320, height: 640 });
  await expect(header).not.toHaveClass(/mat-mdc-tooltip-disabled/);
  await header.locator('.title-label').hover();
  await expect(tooltipOf(page, 'affiliation')).toBeVisible();

  await page.mouse.move(0, 0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(header).toHaveClass(/mat-mdc-tooltip-disabled/);
});

/**
 * An authority's placeholder is one line that cannot wrap, so it has to fit the box at 320 CSS px.
 * The search box of each of the seven authorities is measured, in the language the checks run in.
 */
test('every authority placeholder fits its box at 320 CSS px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, '08-authority');
  await settle(page);
  const placeholders = await page.evaluate(() => {
    const root = document.querySelector('cedar-embeddable-editor')!.shadowRoot!;
    const boxes = [...root.querySelectorAll<HTMLInputElement>('input[placeholder]')];
    return boxes
      .filter((box) => box.placeholder.trim() !== '')
      .map((box) => {
        const style = getComputedStyle(box, '::placeholder');
        const line = document.createElement('span');
        for (const property of ['font', 'letter-spacing', 'word-spacing', 'text-transform'])
          line.style.setProperty(property, style.getPropertyValue(property));
        Object.assign(line.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' });
        line.textContent = box.placeholder;
        box.parentElement!.appendChild(line);
        const needed = Math.ceil(line.getBoundingClientRect().width);
        line.remove();
        const own = getComputedStyle(box);
        return {
          placeholder: box.placeholder,
          needed,
          available: Math.floor(box.clientWidth - parseFloat(own.paddingLeft) - parseFloat(own.paddingRight)),
        };
      });
  });
  expect(placeholders.map(({ placeholder }) => placeholder).sort()).toEqual([
    'Chemical name or PFAS ID',
    'Grant details or NIH Grant ID',
    'Institution name or ROR',
    'Publication name or PubMed ID',
    'Research resource name or RRID',
    'Researcher name or ORCID',
    'Search by title or enter DOI',
  ]);
  for (const { placeholder, needed, available } of placeholders)
    expect(needed, `"${placeholder}" needs ${needed}px of ${available}px`).toBeLessThanOrEqual(available + 1);
});

/** An authority answers a search with two suggestions, the second with a name long enough to wrap. */
const answerSearches = async (page: Page): Promise<void> => {
  await page.route('**/ext-auth/orcid/search**', (route) =>
    route.fulfill({
      json: {
        found: true,
        results: {
          'https://orcid.org/0000-0002-1825-0097': { name: 'Maria Carberry' },
          'https://orcid.org/0000-0001-5109-3700': {
            name: 'Maria Fernanda de los Ángeles Castellanos-Villavicencio de la Torre',
          },
        },
      },
    }),
  );
};

/** The tooltip on screen whose text contains `text`. */
const tooltipWith = (page: Page, text: string): Locator =>
  page.locator('.mat-mdc-tooltip-surface').filter({ hasText: text });

/**
 * One of the textarea field's tooltips, opened as the keyboard opens it, by tabbing onto its mark.
 * At 320 CSS px the description's tooltip covers the whole mark, so a pointer resting on the mark
 * would rest inside the tooltip. No pointer moves here.
 */
const showTooltip = async (page: Page, mark: string, text: string): Promise<void> => {
  const trigger = page
    .locator('.non-iterable-component > app-cedar-component-header')
    .filter({ has: page.locator('.title-label', { hasText: /^\s*textarea\b/ }) })
    .locator(mark);
  // Material opens a tooltip on focus only when a key moved the focus.
  await trigger.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(trigger).toBeFocused();
  await expect(tooltipWith(page, text)).toBeVisible();
  // The tooltip of the mark passed on the way has closed.
  await expect(page.locator('.mat-mdc-tooltip-surface')).toHaveCount(1);
};

/**
 * A terminology lookup answers with two terms, the second with a label long enough to wrap, or, when
 * `fails`, fails.
 */
const answerLookups = async (page: Page, fails = false): Promise<void> => {
  await page.route('http://127.0.0.1:47888/unused/bioportal/integrated-search', (route) =>
    fails
      ? route.abort()
      : route.fulfill({
          json: {
            collection: [
              ['http://purl.obolibrary.org/obo/NCBITaxon_9606', 'Homo sapiens'],
              [
                'http://purl.obolibrary.org/obo/NCBITaxon_63221',
                'Homo neanderthalensis, the Neanderthal, known from remains across Europe and western Asia',
              ],
            ].map(([id, label]) => ({ id, '@id': id, prefLabel: label })),
          },
        }),
  );
};

/**
 * Each kind of overlay CEE opens, with how it is opened over its fixture and what shows it open. The
 * overlay must still be open once a check has measured it, or the check measured the form alone.
 */
const OPEN_OVERLAYS: readonly {
  readonly name: string;
  readonly show: (page: Page) => Promise<void>;
  readonly shown: (page: Page) => Locator;
}[] = [
  {
    name: "the date picker's calendar in its month view",
    show: async (page) => {
      await open(page, '09-temporal');
      await page.locator('app-date-picker').nth(1).getByRole('button', { name: 'Open calendar' }).click();
    },
    shown: (page) => page.locator('mat-month-view'),
  },
  {
    name: "the date picker's calendar in its multi-year view",
    show: async (page) => {
      await open(page, '09-temporal');
      await page.locator('app-date-picker').nth(1).getByRole('button', { name: 'Open calendar' }).click();
      await page.locator('.mat-calendar-period-button').click();
    },
    shown: (page) => page.locator('mat-multi-year-view'),
  },
  {
    name: "a select's open panel",
    show: async (page) => {
      await open(page, '02-choices');
      await page.getByRole('combobox', { name: 'single_list', exact: true }).click();
    },
    shown: (page) => page.getByRole('listbox', { name: 'single_list' }),
  },
  {
    name: "an autocomplete's suggestions",
    show: async (page) => {
      await answerSearches(page);
      await open(page, '08-authority', 'authority');
      await fieldBox(page, 'contributor_orcid').pressSequentially('maria', { delay: 20 });
      await passDebounceWindow(page);
      await expect(page.getByRole('option')).toHaveCount(2, { timeout: 5000 });
    },
    shown: (page) => page.getByRole('option').first(),
  },
  {
    name: 'the download menu',
    show: async (page) => {
      await open(page, '01-input-types', undefined, undefined, undefined, '&f=showDownloadMenu');
      await page.getByRole('button', { name: 'Download', exact: true }).click();
    },
    shown: (page) => page.getByRole('menuitem').first(),
  },
  {
    name: "the tooltip of a field's long description",
    show: async (page) => {
      await serveChanged(page, '01-input-types', (template) => {
        template._ui.propertyDescriptions._textarea = LONG_TEXT;
      });
      await open(page, '01-input-types');
      await showTooltip(page, 'mat-icon.icon-help', LONG_TEXT.slice(0, 20));
    },
    shown: (page) => tooltipWith(page, LONG_TEXT.slice(0, 20)),
  },
  {
    name: "a field's property IRI tooltip",
    show: async (page) => {
      await open(page, '01-input-types');
      await showTooltip(page, '.property-iri', 'https://schema.metadatacenter.org/properties/');
    },
    shown: (page) => tooltipWith(page, 'https://schema.metadatacenter.org/properties/'),
  },
  {
    name: 'the panel of a multi-select with a long option',
    show: async (page) => {
      await serveChanged(page, '02-choices', (template) => {
        template.properties._multi_list.items._valueConstraints.literals.push({ label: LONG_TEXT.slice(0, 120) });
      });
      await open(page, '02-choices');
      await page.getByRole('combobox', { name: 'multi_list', exact: true }).click();
      await expect(page.getByRole('listbox', { name: 'multi_list' }).getByRole('option')).toHaveCount(3);
    },
    shown: (page) => page.getByRole('listbox', { name: 'multi_list' }),
  },
  {
    name: "the time zone select's panel",
    show: async (page) => {
      await open(page, '07-timezone');
      await page.locator('cedar-embeddable-editor').getByRole('combobox').click();
    },
    shown: (page) => page.getByRole('option', { name: 'UTC+05:30', exact: true }),
  },
  {
    name: "a term lookup's suggestions",
    show: async (page) => {
      await answerLookups(page);
      await open(page, '04-controlled-terms');
      await page
        .locator('cedar-embeddable-editor')
        .getByRole('combobox', { name: 'organism', exact: true })
        .pressSequentially('Homo', { delay: 20 });
      await passDebounceWindow(page);
      await expect(page.getByRole('option', { name: /^Homo neanderthalensis/ }).first()).toBeVisible({ timeout: 5000 });
    },
    shown: (page) => page.getByRole('option', { name: /^Homo neanderthalensis/ }).first(),
  },
  {
    name: "a term lookup's failure notice",
    show: async (page) => {
      await answerLookups(page, true);
      await open(page, '04-controlled-terms');
      await page
        .locator('cedar-embeddable-editor')
        .getByRole('combobox', { name: 'organism', exact: true })
        .pressSequentially('Homo', { delay: 20 });
      await passDebounceWindow(page);
      await expect(page.getByRole('option', { name: /^Search failed/ })).toBeVisible({ timeout: 5000 });
    },
    shown: (page) => page.getByRole('option', { name: /^Search failed/ }),
  },
];

for (const { name, show: reach, shown } of OPEN_OVERLAYS) {
  const state = `with ${name} open`;
  for (const [layout, title] of LAYOUT_CHECKS)
    test(`${state}, the form ${title}`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[layout]);
      await reach(page);
      await expect(shown(page)).toBeVisible();
      await check(page, expect, layoutRequest(layout, state));
      await expect(shown(page), 'the overlay stays open while it is measured').toBeVisible();
    });
}

/**
 * A PubMed term keeps its title to one line beside its identifier and link-out. At 320 CSS px the
 * identifier and the link-out cannot share that line, and the box cut them off at its edge. They now
 * take lines of their own inside the box. At 480 CSS px, the width the narrow baselines capture, the
 * term stays on one line.
 */
test('a PubMed term wraps its identifier and link-out at 320 CSS px rather than cutting them off', async ({ page }) => {
  for (const [width, wraps] of [
    [320, true],
    [480, false],
  ] as const) {
    await page.setViewportSize({ width, height: 640 });
    await show(page, '08-authority', 'read only');
    const layout = await page.locator('.cee-term-link-single-line').evaluate((term) => {
      const frame = term.getBoundingClientRect();
      const [label, identifier, action] = ['.cee-term-link-label', '.cee-term-link-iri', '.cee-term-link-action'].map(
        (selector) => term.querySelector(selector)!.getBoundingClientRect(),
      );
      return {
        inside: [identifier, action].every((part) => part.left >= frame.left - 0.5 && part.right <= frame.right + 0.5),
        wraps: identifier.top >= label.bottom,
      };
    });
    expect(layout, `at ${width} CSS px`).toEqual({ inside: true, wraps });
  }
});
