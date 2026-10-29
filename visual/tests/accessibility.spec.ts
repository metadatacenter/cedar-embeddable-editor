import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addAttributeRow, open, passDebounceWindow } from './support/host';

/**
 * Automated WCAG checks over every fixture the suite renders.
 *
 * A rule engine decides names, roles, ARIA validity, the contrast it can compute and target
 * sizes. It cannot decide focus order or what a screen reader announces. The tags are the
 * designer's and the term picker's: WCAG 2.0, 2.1 and 2.2 at levels A and AA. Each template is
 * checked empty, filled with each instance written for it, and read only with and without each
 * instance, at both widths, the narrow one for the rules that read the layout. So is the field
 * element on its own under each presentation preset, comfortable density beside the compact
 * default, searches under way and finished, the open overlays (a calendar in both its views, a
 * select and a menu), and a hovered and a focused control of each kind.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * WCAG 2.1's Label in Name, criterion 2.5.3: a control's accessible name contains the text it shows,
 * so that speech input reaches it by its visible label. axe-core's rule for it is experimental, and
 * a tag selection leaves experimental rules out, so the scan enables it by name beside the tags.
 */
const LABEL_IN_NAME = 'label-content-name-mismatch';

/**
 * The rules whose outcome depends on how the page is laid out rather than on its markup. Contrast
 * reads what is drawn behind each text, target size reads each control's box and its neighbours, and
 * a region scrolls only when its content overflows. Audited at both widths on 2026-10-20, 239 states
 * agreed on every other rule, while contrast differed in 21 and target size in one. The narrow run
 * checks only these rules; the desktop run checks them all.
 */
const LAYOUT_RULES = ['color-contrast', 'target-size', 'scrollable-region-focusable'];

/**
 * The rules whose undecided results this gate settles rather than ignores.
 *
 * axe leaves a result undecided when it cannot measure it: a text's background it cannot read
 * through an overlapping layer, or a target whose spacing it cannot work out. Each such result
 * found so far is listed below with its measured value and the reason it passes. One that is not
 * listed fails the gate, so a new undecided result is a question someone has to answer.
 */
const SETTLED_RULES = ['color-contrast', 'target-size'];

interface Settled {
  readonly rule: (typeof SETTLED_RULES)[number];
  /** Matched against axe's target, written as JSON, so it names the element in any state. */
  readonly target: RegExp;
  readonly measured: string;
  readonly reason: string;
}

/*
 * Measured on 2026-10-20 over every state this suite scans, at both widths, by `measureContrast`
 * below, which also re-measures each of them on every run. No `target-size` result was undecided.
 */
const SETTLED: readonly Settled[] = [
  {
    rule: 'color-contrast',
    target: /#mat-input-\d+"\]\]$/,
    measured: 'values rgba(0, 0, 0, 0.87) at 14.25:1 or more, placeholders #555 at 7.46:1',
    reason: "The outline axe finds over a text box is a border with no fill, so the text is on the box's own surface.",
  },
  {
    rule: 'color-contrast',
    target: /mat-mdc-chip-action-label/,
    measured: '#555 at 6.20:1 on a hovered #eaeaea, #173f3e at 9.99:1 on a selected #e4f1f1',
    reason: 'axe does not judge a one- or two-character number as text; measured, it clears 4.5:1 in every state.',
  },
  {
    rule: 'color-contrast',
    target: /mat-internal-form-field-label/,
    measured: 'rgba(0, 0, 0, 0.87) at 16.07:1 on white',
    reason: "The touch target reaching under a radio's or a checkbox's label is transparent until pressed.",
  },
  {
    rule: 'color-contrast',
    target: /mat-select-trigger|mat-mdc-select-(placeholder|value-text)/,
    measured: 'a value at 16.07:1 and the placeholder #555 at 7.46:1, on white',
    reason: "The outline axe finds over a select's text is a border with no fill.",
  },
  {
    rule: 'color-contrast',
    target: /mdc-list-item__primary-text/,
    measured: 'rgba(0, 0, 0, 0.87) at 12.30:1 on the active option #dadcdc, 15.03:1 on #f4f6f6',
    reason: "An option's ripple and focus layers are the tint the measurement reads, and the text clears it.",
  },
  {
    rule: 'color-contrast',
    target: /mat-mdc-menu-item-text/,
    measured: '#0f7686 at 4.59:1 on the focused item #e4f1f1, 5.31:1 on white',
    reason: "A menu item's ripple and focus layers are the tint the measurement reads, and the text clears it.",
  },
  {
    rule: 'color-contrast',
    target: /title-label|multi-instance-range/,
    measured: 'a label at 16.07:1 and a range #555 at 7.46:1, on white',
    reason: "The occurrence pager drawn over a repeating field's title row is transparent behind the title.",
  },
  {
    rule: 'color-contrast',
    target: /cee-settled-term-(label|iri)/,
    measured: 'rgba(0, 0, 0, 0.87) at 16.07:1 on white',
    reason:
      "The text box laid over a settled term to take its clicks is fully transparent, so the term is on the box's surface.",
  },
];

/**
 * Violations that cannot be fixed without changing what is on screen. Each is listed so the gate
 * passes, and remains a known failure until the screen changes.
 */
const KNOWN_VIOLATIONS: readonly { readonly rule: string; readonly target: RegExp; readonly reason: string }[] = [
  {
    // WCAG 2.5.8. At 480px the link-out icon is 20px square and sits directly after the IRI link,
    // so a 24px circle on it overlaps that link. Passing needs a 24px target or 4px between the two.
    rule: 'target-size',
    target: /cee-term-link-action/,
    reason: "A read-only term's 20px link-out icon touches the term's IRI link at narrow widths.",
  },
];

const settledEntry = (rule: string, target: string): Settled | undefined =>
  SETTLED.find((entry) => entry.rule === rule && entry.target.test(target));

/** An undecided text's colours, as drawn, and the contrast WCAG asks of it. */
interface Measurement {
  readonly target: string;
  readonly ratio: number;
  readonly required: number;
  readonly foreground: string;
  readonly background: string;
}

/** WCAG 2's relative luminance of an sRGB colour. */
const luminance = (rgb: readonly number[]): number => {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (one: readonly number[], other: readonly number[]): number => {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Measure the contrast of texts axe could not decide, from what the page actually draws.
 *
 * axe reads a text's background from the elements stacked under it and gives up where one overlaps
 * another, as a form field's outline overlaps its input. This takes the background from the
 * rendering instead: every such text is made transparent, the page is captured once, and the most
 * frequent colour inside each text's box is its background. The foreground is the colour the text
 * is declared in, a placeholder's included, laid over that background at its opacity.
 */
async function measureContrast(page: Page, targets: readonly (readonly string[])[]): Promise<Measurement[]> {
  const boxes = await page.evaluate((paths) => {
    const parse = (color: string): number[] => (color.match(/[\d.]+/g) ?? ['0', '0', '0', '1']).map(Number);
    return paths.map((path) => {
      let root: Document | ShadowRoot = document;
      let element: Element | null = null;
      for (const [index, selector] of path.entries()) {
        element = root.querySelector(selector);
        if (element === null) return null;
        if (index < path.length - 1 && element.shadowRoot) root = element.shadowRoot;
      }
      if (!(element instanceof HTMLElement)) return null;
      const style = getComputedStyle(element);
      const colors = [parse(style.color)];
      if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.placeholder)
        colors.push(parse(getComputedStyle(element, '::placeholder').color));
      let opacity = 1;
      for (
        let node: Element | null = element;
        node;
        node = node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null
      )
        opacity *= Number(getComputedStyle(node).opacity);
      const size = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      const rect = element.getBoundingClientRect();
      element.setAttribute('data-cee-contrast-probe', '');
      const rootNode = element.getRootNode() as Document | ShadowRoot;
      if (!rootNode.querySelector?.('style[data-cee-contrast-probe]')) {
        const probe = document.createElement('style');
        probe.setAttribute('data-cee-contrast-probe', '');
        probe.textContent =
          '[data-cee-contrast-probe], [data-cee-contrast-probe] *, [data-cee-contrast-probe]::placeholder' +
          ' { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }';
        (rootNode instanceof Document ? rootNode.head : rootNode).appendChild(probe);
      }
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        colors,
        opacity,
        large: size >= 24 || (bold && size >= 18.66),
      };
    });
  }, targets);
  const shot = (await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' })).toString('base64');
  const backgrounds = await page.evaluate(
    async ({ image, rects }) => {
      for (const probe of document.querySelectorAll('[data-cee-contrast-probe]'))
        probe.removeAttribute('data-cee-contrast-probe');
      for (const host of document.querySelectorAll('*'))
        host.shadowRoot
          ?.querySelectorAll('[data-cee-contrast-probe]')
          .forEach((probe) =>
            probe.tagName === 'STYLE' ? probe.remove() : probe.removeAttribute('data-cee-contrast-probe'),
          );
      const picture = new Image();
      picture.src = `data:image/png;base64,${image}`;
      await picture.decode();
      const canvas = document.createElement('canvas');
      canvas.width = picture.width;
      canvas.height = picture.height;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(picture, 0, 0);
      return rects.map((rect) => {
        if (rect === null || rect.width < 1 || rect.height < 1) return null;
        const pixels = context.getImageData(
          Math.floor(rect.x),
          Math.floor(rect.y),
          Math.ceil(rect.width),
          Math.ceil(rect.height),
        ).data;
        const counts = new Map<string, number>();
        for (let index = 0; index < pixels.length; index += 4) {
          const key = `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1])[0][0]
          .split(',')
          .map(Number);
      });
    },
    { image: shot, rects: boxes },
  );
  return targets.map((target, index) => {
    const box = boxes[index];
    const background = backgrounds[index];
    // A settled text the measurement cannot find or see is not settled.
    if (box === null || background === null)
      return {
        target: JSON.stringify(target),
        ratio: 0,
        required: 4.5,
        foreground: 'unmeasured',
        background: 'unmeasured',
      };
    const ratio = Math.min(
      ...box.colors.map(([r, g, b, alpha = 1]) => {
        const a = alpha * box.opacity;
        return contrast(
          [r, g, b].map((channel, c) => a * channel + (1 - a) * background[c]),
          background,
        );
      }),
    );
    return {
      target: JSON.stringify(target),
      ratio,
      required: box.large ? 3 : 4.5,
      foreground: box.colors.map((color) => `rgba(${color.join(', ')})`).join(' / '),
      background: `rgb(${background.join(', ')})`,
    };
  });
}

const files = readdirSync(fileURLToPath(new URL('../fixtures/', import.meta.url)))
  .filter((name) => name.endsWith('.json'))
  .map((name) => name.slice(0, -'.json'.length));
const templates = files.filter((name) => !name.endsWith('-instance'));
/** An instance belongs to the longest template name it starts with. */
const instancesOf = (template: string) =>
  files.filter(
    (name) =>
      name.endsWith('-instance') &&
      name.startsWith(`${template}-`) &&
      !templates.some((other) => other.length > template.length && name.startsWith(`${other}-`)),
  );

/**
 * Check the whole page once it is still, so contrast is read at full opacity.
 *
 * A stored instance's validation messages appear after the form has loaded, and fade in when they
 * do, later on a slower machine. So the page counts as still only after three passes a tenth of a
 * second apart find nothing running. A shadow tree's animations are listed on its root.
 */
async function expectAccessible(page: Page, state: string): Promise<void> {
  await page.evaluate(async () => {
    let quiet = 0;
    for (let pass = 0; pass < 40 && quiet < 3; pass++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const roots: DocumentOrShadowRoot[] = [document];
      for (const element of document.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
      const running = roots
        .flatMap((root) => root.getAnimations())
        .filter(
          (animation) => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity,
        );
      quiet = running.length ? 0 : quiet + 1;
      await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
    }
  });
  const builder = new AxeBuilder({ page }).exclude({ fromShadowDom: ['cedar-embeddable-editor', 'iframe'] });
  const narrow = test.info().project.name === 'narrow';
  // axe-core lets a rule enabled by name override the tag selection, so one desktop scan covers both.
  // The builder's `options` replaces every option set before it, so it comes ahead of `withTags`.
  const scan = narrow
    ? await builder.withRules(LAYOUT_RULES).analyze()
    : await builder
        .options({ rules: { [LABEL_IN_NAME]: { enabled: true } } })
        .withTags(WCAG)
        .analyze();
  if (!narrow) {
    // A builder that dropped the rule option would stop checking Label in Name and fail nothing, so
    // the desktop scan must report the rule.
    const evaluated = [scan.passes, scan.violations, scan.incomplete, scan.inapplicable].flat();
    expect(
      evaluated.some((result) => result.id === LABEL_IN_NAME),
      `${LABEL_IN_NAME} did not run`,
    ).toBe(true);
  }
  const { violations, incomplete } = scan;
  // A label on an element whose role takes none is ignored by screen readers, decided or not.
  const ignoredLabels = incomplete.filter((result) => result.id === 'aria-prohibited-attr');
  const failures = [...violations, ...ignoredLabels].flatMap((violation) =>
    violation.nodes
      .filter(
        (node) =>
          !KNOWN_VIOLATIONS.some(
            (known) => known.rule === violation.id && known.target.test(JSON.stringify(node.target)),
          ),
      )
      .map((node) => `${violation.id}: ${JSON.stringify(node.target)}`),
  );
  const pending = incomplete
    .filter((result) => SETTLED_RULES.includes(result.id))
    .flatMap((result) => result.nodes.map((node) => ({ rule: result.id, node })));
  const undecided = pending
    .filter(({ rule, node }) => settledEntry(rule, JSON.stringify(node.target)) === undefined)
    .map(
      ({ rule, node }) =>
        `undecided ${rule} (${String(node.any[0]?.data?.messageKey ?? node.any[0]?.message)}): ` +
        JSON.stringify(node.target),
    );
  // A settled contrast is measured again, so the list cannot outlive the colours it was measured on.
  const remeasured = await measureContrast(
    page,
    pending
      .filter(({ rule, node }) => rule === 'color-contrast' && settledEntry(rule, JSON.stringify(node.target)))
      .map(({ node }) => node.target.flat()),
  );
  const tooLow = remeasured
    .filter((measurement) => measurement.ratio < measurement.required)
    .map(
      (measurement) =>
        `color-contrast ${measurement.ratio.toFixed(2)}:1 < ${measurement.required}:1, ${measurement.foreground} on ` +
        `${measurement.background}: ${measurement.target}`,
    );
  expect.soft([...failures, ...undecided, ...tooLow], state).toEqual([]);
}

/**
 * Focus a control as the keyboard would.
 *
 * A page nobody has pointed at treats a focus a script moves as keyboard focus, so the control
 * draws its focus ring, which is the state this checks. The assertion says so rather than assumes.
 */
async function focusAsKeyboard(control: Locator): Promise<void> {
  await control.focus();
  await expect(control).toBeFocused();
  expect(await control.evaluate((element) => element.matches(':focus-visible')), 'no focus ring drawn').toBe(true);
}

for (const template of templates)
  test(`${template}, empty, filled and read only`, async ({ page }) => {
    await open(page, template);
    await expectAccessible(page, `${template} empty`);
    for (const instance of instancesOf(template)) {
      await open(page, template, undefined, instance);
      await expectAccessible(page, instance);
    }
    await open(page, template, 'readonly');
    await expectAccessible(page, `${template} read only`);
  });

for (const template of templates.filter((name) => instancesOf(name).length > 0))
  test(`${template}, read only with each of its instances`, async ({ page }) => {
    for (const instance of instancesOf(template)) {
      await open(page, template, 'readonly', instance);
      await expectAccessible(page, `${instance} read only`);
    }
  });

const fixturesDir = new URL('../fixtures/', import.meta.url);
const orderOf = (fixture: string): string[] =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`${fixture}.json`, fixturesDir)), 'utf8'))._ui.order;

for (const fixture of ['01-input-types', '02-choices', '08-authority', '09-temporal'])
  for (const property of orderOf(fixture))
    test(`the field element for ${fixture} ${property}, editable, read only and in preview`, async ({ page }) => {
      for (const preset of [undefined, 'readonly', 'preview', 'preview-typed']) {
        await open(page, fixture, preset, undefined, undefined, `&host=field&p=${property}`);
        await expectAccessible(page, `${fixture} ${property} ${preset ?? 'editable'}`);
      }
    });

for (const fixture of ['01-input-types', '02-choices', '09-temporal'])
  test(`${fixture} at comfortable density`, async ({ page }) => {
    for (const preset of [undefined, 'readonly']) {
      await open(page, fixture, preset);
      await page.locator('cedar-embeddable-editor').evaluate((editor) => editor.setAttribute('density', 'comfortable'));
      await expectAccessible(page, `${fixture} comfortable ${preset ?? 'editable'}`);
    }
  });

test('an authority search under way, and one that found nothing', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('http://127.0.0.1:9/**', async (route) => {
    await pending;
    await route.fulfill({ json: { found: false, results: {} } });
  });
  await open(page, '08-authority', undefined, undefined, undefined, '&host=field&p=_contributor_orcid');
  const field = page.locator('cedar-embeddable-field');
  await field.locator('input').first().fill('Unmatched example');
  await expect(field.getByText('Searching…', { exact: true })).toBeVisible();
  await expectAccessible(page, 'authority search under way');
  release();
  await expect(field.getByRole('option', { name: 'No results found', exact: true })).toBeVisible();
  await expectAccessible(page, 'authority search that found nothing');
});

test('a term lookup under way, and one that failed', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('http://127.0.0.1:9/**', async (route) => {
    await pending;
    await route.abort();
  });
  await open(page, '04-controlled-terms');
  const organism = page.locator('input[aria-label="organism"]');
  await organism.fill('Homo');
  await passDebounceWindow(page);
  await expect(page.getByRole('option', { name: 'Searching…', exact: true })).toBeVisible();
  await expectAccessible(page, 'term lookup under way');
  release();
  await expect(page.getByRole('option', { name: /^Search failed/ })).toBeVisible();
  await expectAccessible(page, 'term lookup that failed');
});

test('an open calendar, in its month view and its multi-year view', async ({ page }) => {
  await open(page, '09-temporal');
  const dayPicker = page.locator('app-date-picker').nth(1);
  await dayPicker.getByRole('button', { name: 'Open calendar' }).click();
  await expect(page.locator('mat-month-view')).toBeVisible();
  await expectAccessible(page, 'calendar month view');
  // The focused date carries the shared focus ring, because its tint is too faint to show focus.
  await page.keyboard.press('ArrowRight');
  const focused = page.locator('.mat-calendar-body-active > .mat-calendar-body-cell-content');
  await expect(focused).toHaveCSS('outline-style', 'solid');
  await expect(focused).toHaveCSS('outline-color', 'rgb(15, 118, 134)');
  await page.locator('.mat-calendar-period-button').click();
  await expect(page.locator('mat-multi-year-view')).toBeVisible();
  await expectAccessible(page, 'calendar multi-year view');
  await page.keyboard.press('Escape');
  await page.locator('app-date-picker').first().getByRole('button', { name: 'Open calendar' }).click();
  await expect(page.locator('mat-multi-year-view')).toBeVisible();
  await expectAccessible(page, 'year calendar');
});

test('an open select, single and multiple', async ({ page }) => {
  await open(page, '02-choices');
  await page.getByRole('combobox', { name: 'single_list', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'single_list' })).toBeVisible();
  await expectAccessible(page, 'single select open');
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'multi_list', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'multi_list' })).toBeVisible();
  await expectAccessible(page, 'multiple select open');
});

test('an open menu, its item focused and hovered', async ({ page }) => {
  await open(page, '01-input-types', undefined, undefined, undefined, '&f=showDownloadMenu');
  const download = page.getByRole('button', { name: 'Download', exact: true });
  await download.focus();
  await download.press('Enter');
  const items = page.getByRole('menuitem');
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  expect(await items.nth(1).evaluate((item) => item.matches(':focus-visible'))).toBe(true);
  await expectAccessible(page, 'menu open, an item focused');
  await items.nth(3).hover();
  await expectAccessible(page, 'menu item hovered');
});

/**
 * One hovered and one focused control of each kind, each on a page of its own so that the other
 * state cannot linger. A hover can open a tooltip, which is scanned with it.
 */
const REPRESENTATIVES: ReadonlyArray<{
  kind: string;
  fixture: string;
  instance?: string;
  control: (page: Page) => Promise<Locator>;
}> = [
  {
    kind: 'icon button',
    fixture: '01-input-types',
    control: async (page) => page.getByRole('button', { name: 'Expand All', exact: true }),
  },
  {
    kind: 'clear button',
    fixture: '02-choices',
    control: async (page) => page.locator('app-cedar-input-select').getByRole('button', { name: 'Clear' }),
  },
  {
    kind: 'outlined button',
    fixture: '09-temporal',
    control: async (page) => page.getByRole('button', { name: 'Switch between AM and PM' }).first(),
  },
  {
    kind: 'help mark',
    fixture: '01-input-types',
    control: async (page) => page.getByRole('img', { name: 'Description', exact: true }).first(),
  },
  {
    kind: 'property mark',
    fixture: '01-input-types',
    control: async (page) => page.getByRole('img', { name: /^Property IRI: / }).first(),
  },
  {
    kind: 'text box',
    fixture: '01-input-types',
    control: async (page) => page.getByRole('textbox', { name: 'text', exact: true }),
  },
  {
    kind: 'attribute box',
    fixture: '10-attribute-values',
    control: async (page) => {
      await addAttributeRow(page);
      return page.getByRole('textbox', { name: 'Attribute Name', exact: true });
    },
  },
  {
    kind: 'select',
    fixture: '02-choices',
    control: async (page) => page.getByRole('combobox', { name: 'single_list', exact: true }),
  },
  {
    kind: 'occurrence chip',
    fixture: '03-nested-multi',
    control: async (page) => page.locator('app-cedar-multi-pager').first().getByRole('option', { name: '2' }),
  },
  {
    kind: 'page chip',
    fixture: '05-static-paged',
    control: async (page) => page.locator('.page-break-paginator-container').getByRole('option', { name: '2' }),
  },
  {
    kind: 'radio',
    fixture: '02-choices',
    control: async (page) => page.getByRole('radio', { name: 'Gamma' }),
  },
  {
    kind: 'checkbox',
    fixture: '02-choices',
    control: async (page) => page.getByRole('checkbox', { name: 'Two' }),
  },
  {
    kind: 'link',
    fixture: '04-controlled-terms',
    instance: '04-controlled-terms-instance',
    control: async (page) => page.getByRole('link', { name: 'Open the ORCID page' }).first(),
  },
];

for (const { kind, fixture, instance, control } of REPRESENTATIVES)
  test(`a ${kind}, hovered and focused`, async ({ page }) => {
    await open(page, fixture, undefined, instance);
    await (await control(page)).hover();
    await expectAccessible(page, `${kind} hovered`);
    await open(page, fixture, undefined, instance);
    await focusAsKeyboard(await control(page));
    await expectAccessible(page, `${kind} focused`);
  });
