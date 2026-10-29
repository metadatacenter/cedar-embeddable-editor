import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { open, passDebounceWindow } from './support/host';

/**
 * WCAG 1.4.10 Reflow, 1.4.4 Resize Text, 1.4.12 Text Spacing, 1.4.3 Contrast (Minimum) for
 * placeholders and 1.4.11 Non-text Contrast for field boundaries. The four CEDAR browser components
 * check these the same way.
 *
 * - Reflow. At 320 CSS px wide, neither the page nor a scroll container of CEE's scrolls
 *   sideways, no text is clipped or overlaps other text, and every control can be reached.
 * - Resize. In a 640 by 400 CSS px viewport, which is a 1280 by 800 window at 200% zoom, no text is
 *   clipped or overlaps other text, and every control can be reached.
 * - Text spacing. With WCAG's line, letter, word and paragraph spacing forced on the page and on
 *   every shadow root, at 1280 px wide, no text is clipped or overlaps other text.
 * - Placeholders. Every placeholder clears 4.5:1 against the background it sits on. axe does not
 *   measure placeholder text.
 * - Boundaries. Every text-entry or selection control that draws a boundary draws it at least 3:1
 *   against what lies outside it. The token test measures the token's value; this measures what
 *   the browser draws, so a framework default or a local override that replaces the token fails.
 * - Indicators. Every icon that alone identifies a control, every focus indicator and every
 *   selection mark measures at least 3:1 against what it is drawn on, as the browser draws it.
 *
 * A placeholder is text too, and since it cannot wrap, a box that is too narrow for it clips it. So
 * is the value a read-only box shows on its one line.
 *
 * Each check runs over the input types, choices, authority and temporal fixtures, a nested one and a
 * multi-page one, editable and read only, and over the field element showing one field of each of
 * the first four. It also runs over the input types, controlled terms and authority fixtures read
 * only, each box holding a value too long for one line. Reflow, resize and text spacing also run
 * over a form with each kind of overlay open: the date picker's calendar in its month and multi-year
 * views, a select's panel, a multi-select's panel with a long option, the time zone select's panel,
 * an autocomplete's suggestions, a term lookup's suggestions and its failure notice, the download
 * menu, and a field's description and property IRI tooltips. An overlay is fixed to the viewport, so
 * the page cannot be scrolled to what it puts outside it, and the viewport clips it as an ancestor
 * that hides its overflow does. A finding that cannot be fixed without a visible change is listed in
 * `EXCEPTIONS` with the change it needs.
 */

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

/**
 * Wait until every finite animation on the page has finished, as an overlay's entrance does.
 *
 * `document.getAnimations()` leaves out the animations that run in a shadow root, and everything CEE
 * draws is in one, so each root is asked as well. Measured during a select panel's entrance, its
 * options were transparent and so went unmeasured, or measured and found wanting, by turns.
 */
const animationsDone = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => {
    const roots: (Document | ShadowRoot)[] = [document];
    for (const root of roots)
      for (const element of root.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
    return roots.every((root) =>
      root
        .getAnimations()
        .every(
          (animation) =>
            animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity,
        ),
    );
  });

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
  await animationsDone(page);
};

const TEXT_SPACING =
  '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } ' +
  'p { margin-bottom: 2em !important; }';

type Check = 'reflow' | 'resize' | 'text spacing' | 'placeholder' | 'boundary' | 'indicator';

interface Exception {
  readonly check: Check;
  /** Matched against the finding, which names the element by its tag, classes and text. */
  readonly finding: RegExp;
  /** The visible change that would remove the finding. */
  readonly needs: string;
}

/** Findings that need a visible change, each with the change it needs. */
const EXCEPTIONS: readonly Exception[] = [
  /*
   * At 320 CSS px an authority box has 264px for its placeholder, and the PubMed and RRID
   * instructions need about 271px and 276px, so each loses its last letters. A placeholder is one
   * line that cannot wrap, and its type and the box's padding are the shared control's.
   */
  {
    check: 'reflow',
    finding: /^placeholder is clipped: "Start typing (publication name or PubMed ID|research resource name or RRID)"/,
    needs:
      'a placeholder that fits a 320 CSS px box: a shorter instruction, or the instruction moved out of the box ' +
      'into hint text that wraps',
  },
  /*
   * Read only, a text, email or phone value is shown in a one-line box, which cuts off what does not
   * fit with nothing to say that more follows. A reader reaches the rest only by putting the caret in
   * the box and moving it. At 320 CSS px a sentence, a long address and a long number are each cut
   * off, and at 640 and at 1280 under text spacing the sentence still is. A paragraph field's value
   * already wraps, because its box grows to hold it.
   */
  ...(['reflow', 'resize', 'text spacing'] as const).map((check) => ({
    check,
    finding: /^value is clipped: the box "(text|email|phone)" /,
    needs:
      'a read-only value that wraps onto further lines, as a paragraph value does, rather than one cut off at ' +
      'the edge of a one-line box',
  })),
];

/**
 * What the page shows that breaks a check, one line per finding.
 *
 * Runs in the page. An element is named by its tag, its first classes and the start of its text, so
 * a finding reads the same at any width and can be matched by an exception.
 */
function findLayoutProblems(options: { scrolling: boolean; controls: boolean; text: boolean }): string[] {
  const host = document.querySelector('cedar-embeddable-editor, cedar-embeddable-field')!;
  const root = host.shadowRoot!;
  const viewportWidth = document.documentElement.clientWidth;
  const findings: string[] = [];

  const parentOf = (node: Element): Element | null =>
    node.parentElement ?? ((node.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;

  const name = (element: Element): string => {
    const classes = [...element.classList].filter((name) => !name.startsWith('ng-') && !name.startsWith('_ng'));
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${element.tagName.toLowerCase()}${classes
      .slice(0, 3)
      .map((c) => `.${c}`)
      .join('')}${text ? ` "${text}"` : ''}`;
  };

  /** Shown, and not text kept for a screen reader alone. */
  const shown = (element: Element): boolean =>
    element.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
    element.closest('.cdk-visually-hidden') === null;

  interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }

  /**
   * Each ancestor, the element first, that cuts off what overflows it, with the box it cuts to. An
   * inline element is skipped, since overflow does not apply to it. A scroll container is skipped
   * too: what it hides can be scrolled to, and one that scrolls sideways is a finding of its own.
   * Content fixed to the viewport, as an overlay is, cannot be scrolled to either, so the viewport
   * cuts it off.
   *
   * What a scroll container holds can be scrolled to any place in the container's own box. A box
   * further out therefore cuts that content off only on a side where it cuts off the container. A
   * select's panel scrolls, and an option scrolled out of the panel is not cut off by the viewport
   * unless the panel is.
   */
  const clippers = (element: Element): { ancestor: Element | 'the viewport'; box: Partial<Box> }[] => {
    const found: { ancestor: Element | 'the viewport'; box: Partial<Box> }[] = [];
    // The box of the nearest scroll container passed so far, in each direction it scrolls.
    let across: Box | null = null;
    let down: Box | null = null;
    const beyond = (box: Partial<Box>): Partial<Box> => ({
      ...(box.left !== undefined && (across === null || across.left < box.left - 1) ? { left: box.left } : {}),
      ...(box.right !== undefined && (across === null || across.right > box.right + 1) ? { right: box.right } : {}),
      ...(box.top !== undefined && (down === null || down.top < box.top - 1) ? { top: box.top } : {}),
      ...(box.bottom !== undefined && (down === null || down.bottom > box.bottom + 1) ? { bottom: box.bottom } : {}),
    });
    const scrolls = (overflow: string): boolean => overflow === 'auto' || overflow === 'scroll';
    for (
      let ancestor: Element | null = element;
      ancestor && ancestor !== document.documentElement;
      ancestor = parentOf(ancestor)
    ) {
      const style = getComputedStyle(ancestor);
      const boxed = style.display !== 'inline' && style.display !== 'contents';
      const frame = ancestor.getBoundingClientRect();
      const left = frame.left + ancestor.clientLeft;
      const top = frame.top + ancestor.clientTop;
      const inner = { left, top, right: left + ancestor.clientWidth, bottom: top + ancestor.clientHeight };
      if (boxed && across === null && scrolls(style.overflowX)) across = inner;
      if (boxed && down === null && scrolls(style.overflowY)) down = inner;
      if (style.position === 'fixed')
        found.push({
          ancestor: 'the viewport',
          box: beyond({ left: 0, right: viewportWidth, top: 0, bottom: document.documentElement.clientHeight }),
        });
      const x = style.overflowX === 'hidden' || style.overflowX === 'clip';
      const y = style.overflowY === 'hidden' || style.overflowY === 'clip';
      if ((!x && !y) || !boxed) continue;
      found.push({
        ancestor,
        box: beyond({
          ...(x ? { left: inner.left, right: inner.right } : {}),
          ...(y ? { top: inner.top, bottom: inner.bottom } : {}),
        }),
      });
    }
    return found;
  };

  /** Whether a rectangle reaches more than a pixel past a clipping box on any side it clips. */
  const escapes = (rect: Box, box: Partial<Box>): boolean =>
    (box.left !== undefined && rect.left < box.left - 1) ||
    (box.right !== undefined && rect.right > box.right + 1) ||
    (box.top !== undefined && rect.top < box.top - 1) ||
    (box.bottom !== undefined && rect.bottom > box.bottom + 1);

  /** A rectangle cut to what every clipping box leaves of it. */
  const cut = (rect: Box, boxes: Partial<Box>[]): Box =>
    boxes.reduce<Box>(
      (part, box) => ({
        left: Math.max(part.left, box.left ?? -Infinity),
        right: Math.min(part.right, box.right ?? Infinity),
        top: Math.max(part.top, box.top ?? -Infinity),
        bottom: Math.min(part.bottom, box.bottom ?? Infinity),
      }),
      { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
    );

  if (options.scrolling) {
    const page = document.scrollingElement!;
    if (page.scrollWidth > page.clientWidth + 1)
      findings.push(`the page scrolls sideways — ${page.scrollWidth}px in ${page.clientWidth}px`);
    for (const element of root.querySelectorAll('*')) {
      const style = getComputedStyle(element);
      if (
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        element.scrollWidth > element.clientWidth + 1 &&
        shown(element)
      )
        findings.push(`scrolls sideways: ${name(element)} — ${element.scrollWidth}px in ${element.clientWidth}px`);
    }
  }

  if (options.controls) {
    const controls = root.querySelectorAll(
      'input:not([type="hidden"]), textarea, button, a[href], mat-select, mat-radio-button, mat-checkbox, ' +
        '[role="option"], [role="img"][tabindex], [tabindex="0"]',
    );
    for (const control of controls) {
      if (!shown(control)) continue;
      const box = control.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      // Reached means its centre is on the page's width and inside everything that clips it.
      const part = cut(box, [{ left: 0, right: viewportWidth }, ...clippers(parentOf(control)!).map(({ box }) => box)]);
      const x = (box.left + box.right) / 2;
      const y = (box.top + box.bottom) / 2;
      if (x < part.left || x > part.right || y < part.top || y > part.bottom)
        findings.push(`cannot be reached: ${name(control)} — centre at ${Math.round(x)}px of ${viewportWidth}px`);
    }
  }

  if (options.text) {
    interface Text {
      element: Element;
      rects: Box[];
    }
    const texts: Text[] = [];
    for (const element of root.querySelectorAll('*')) {
      if (element.closest('svg, style, script')) continue;
      const nodes = [...element.childNodes].filter(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
      );
      if (nodes.length === 0 || !shown(element)) continue;
      const rects: Box[] = [];
      for (const node of nodes) {
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(...[...range.getClientRects()].filter((rect) => rect.width >= 1 && rect.height >= 1));
      }
      if (rects.length > 0) texts.push({ element, rects });
    }

    for (const text of texts) {
      const cutters = clippers(text.element);
      const clipper = cutters.find(({ box }) => text.rects.some((rect) => escapes(rect, box)));
      if (clipper) {
        const ellipsis = [text.element, clipper.ancestor].some(
          (element) => element instanceof Element && getComputedStyle(element).textOverflow === 'ellipsis',
        );
        // An ellipsis is a clip a reader is told about, and a title or a tooltip gives the rest.
        const elsewhere = text.element.closest('[title], .mat-mdc-tooltip-trigger') !== null;
        const by = clipper.ancestor instanceof Element ? name(clipper.ancestor) : clipper.ancestor;
        if (!(ellipsis && elsewhere))
          findings.push(`text is clipped: ${name(text.element)}${ellipsis ? ' behind an ellipsis' : ''} by ${by}`);
      }
      // Overlap is judged on what is drawn, so text a clip hides cannot overlap anything.
      text.rects = text.rects
        .map((rect) =>
          cut(
            rect,
            cutters.map(({ box }) => box),
          ),
        )
        .filter((rect) => rect.right - rect.left >= 1 && rect.bottom - rect.top >= 1);
    }

    const overlap = (a: Box, b: Box): boolean =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    // An overlay is drawn over the page on purpose, so text it covers is hidden rather than
    // overlapped. Text is compared with the text of its own layer: the page, or one overlay.
    const layerOf = (element: Element): Element | null => element.closest('.cdk-overlay-pane');
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const [a, b] = [texts[i], texts[j]];
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        if (layerOf(a.element) !== layerOf(b.element)) continue;
        if (a.rects.some((one) => b.rects.some((other) => overlap(one, other))))
          findings.push(`text overlaps: ${name(a.element)} and ${name(b.element)}`);
      }

    /**
     * How wide a box's one line of text is, set in the given style, and how much of the box's width
     * its content gets. A box cuts off what does not fit on its line.
     */
    const lineIn = (box: HTMLInputElement, text: string, style: CSSStyleDeclaration) => {
      const line = document.createElement('span');
      for (const property of ['font', 'letter-spacing', 'word-spacing', 'text-transform'])
        line.style.setProperty(property, style.getPropertyValue(property));
      Object.assign(line.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' });
      line.textContent = text;
      box.parentElement!.appendChild(line);
      const needed = line.getBoundingClientRect().width;
      line.remove();
      const own = getComputedStyle(box);
      return { needed, available: box.clientWidth - parseFloat(own.paddingLeft) - parseFloat(own.paddingRight) };
    };

    // A placeholder is text as well. It is measured in the placeholder's own style.
    for (const box of root.querySelectorAll<HTMLInputElement>('input[placeholder]')) {
      if (!box.placeholder.trim() || box.value !== '' || !shown(box)) continue;
      const { needed, available } = lineIn(box, box.placeholder, getComputedStyle(box, '::placeholder'));
      if (needed > available + 1)
        findings.push(
          `placeholder is clipped: "${box.placeholder}" needs ${Math.ceil(needed)}px of ${Math.floor(available)}px`,
        );
    }

    // A read-only box shows a value to be read, and a value longer than the box's line is cut off
    // with nothing to say so. An editable box is left out: what it holds scrolls with the caret as it
    // is typed and edited.
    for (const box of root.querySelectorAll<HTMLInputElement>('input[readonly]')) {
      if (!box.value.trim() || !shown(box)) continue;
      const { needed, available } = lineIn(box, box.value, getComputedStyle(box));
      const label =
        box.getAttribute('aria-label') ??
        (box.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .map((id) => (id ? (root.getElementById(id)?.textContent ?? '') : ''))
          .join(' ')
          .trim();
      if (needed > available + 1)
        findings.push(
          `value is clipped: the box "${label}" holding "${box.value.slice(0, 40)}" ` +
            `needs ${Math.ceil(needed)}px of ${Math.floor(available)}px`,
        );
    }
  }

  return findings;
}

/** Placeholders below 4.5:1 on what they sit on. Runs in the page. */
function findFaintPlaceholders(): string[] {
  const root = document.querySelector('cedar-embeddable-editor, cedar-embeddable-field')!.shadowRoot!;
  const parse = (color: string): number[] => (color.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
  const luminance = ([r, g, b]: number[]): number => {
    const linear = [r, g, b].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const over = (top: number[], bottom: number[]): number[] => {
    const alpha = top[3] ?? 1;
    return [0, 1, 2].map((c) => alpha * top[c] + (1 - alpha) * bottom[c]);
  };
  const findings: string[] = [];
  for (const box of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[placeholder], textarea[placeholder]',
  )) {
    if (!box.placeholder.trim() || !box.checkVisibility()) continue;
    // The background is every layer under the box, from the page up.
    const layers: number[][] = [];
    for (
      let node: Element | null = box;
      node;
      node = node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null
    ) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if ((color[3] ?? 1) > 0) layers.push(color);
    }
    const background = layers.reverse().reduce((under, layer) => over(layer, under), [255, 255, 255]);
    const placeholder = getComputedStyle(box, '::placeholder');
    const color = parse(placeholder.color);
    color[3] = (color[3] ?? 1) * Number(placeholder.opacity);
    const lighter = Math.max(luminance(over(color, background)), luminance(background));
    const darker = Math.min(luminance(over(color, background)), luminance(background));
    const ratio = (lighter + 0.05) / (darker + 0.05);
    if (ratio < 4.5)
      findings.push(
        `placeholder "${box.placeholder}" at ${ratio.toFixed(2)}:1, ${placeholder.color} on rgb(${background.map(Math.round).join(', ')})`,
      );
  }
  return findings;
}

/**
 * Field boundaries below 3:1 against what lies outside them, and how many boundaries were measured.
 * Runs in the page.
 *
 * A control's boundary is drawn by the border of the control itself, of an ancestor at most three
 * levels up whose box is at most 48px larger each way, or of an element in an absolutely positioned
 * layer within such an ancestor, as a Material outlined field's outline is. The strongest side of
 * any of them must measure 3:1 against the colour outside the box that holds it. A control that
 * draws no boundary is not measured, because 1.4.11 asks for contrast in what identifies a control
 * rather than for a boundary; a disabled control is exempt, as 1.4.11 exempts inactive components.
 */
function findFaintBoundaries(): { findings: string[]; measured: number } {
  const host = document.querySelector('cedar-embeddable-editor, cedar-embeddable-field')!;
  const roots: ShadowRoot[] = [host.shadowRoot!];
  for (const root of roots)
    for (const element of root.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
  const parse = (color: string): number[] => (color.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
  const luminance = ([r, g, b]: number[]): number => {
    const linear = [r, g, b].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const over = (top: number[], bottom: number[]): number[] => {
    const alpha = top[3] ?? 1;
    return [0, 1, 2].map((c) => alpha * top[c] + (1 - alpha) * bottom[c]);
  };
  const contrast = (a: number[], b: number[]): number => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  const rgb = (colour: number[]): string => `rgb(${colour.map(Math.round).join(', ')})`;
  const parent = (element: Element): Element | null =>
    element.assignedSlot ?? element.parentElement ?? ((element.getRootNode() as ShadowRoot).host || null);
  const contains = (outer: Element, inner: Element): boolean => {
    for (let node: Element | null = inner; node; node = parent(node)) if (node === outer) return true;
    return false;
  };
  /** Every layer under `element`, its own included, from the page up. */
  const behind = (element: Element): number[] => {
    const layers: number[][] = [];
    for (let node: Element | null = element; node; node = parent(node)) {
      const color = parse(getComputedStyle(node).backgroundColor);
      if ((color[3] ?? 1) > 0) layers.push(color);
    }
    return layers.reverse().reduce((under, layer) => over(layer, under), [255, 255, 255]);
  };
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;
  /** The colours of the sides of `element` that draw a border. */
  const borders = (element: Element): number[][] => {
    const own = getComputedStyle(element);
    return SIDES.flatMap((side) => {
      const colour = parse(own[`border${side}Color`]);
      const drawn =
        parseFloat(own[`border${side}Width`]) >= 1 &&
        !['none', 'hidden'].includes(own[`border${side}Style`]) &&
        (colour[3] ?? 1) > 0;
      return drawn ? [colour] : [];
    });
  };
  const FIELDS =
    'input:not([type="hidden"], [type="checkbox"], [type="radio"], [type="range"], [type="color"], ' +
    '[type="file"], [type="button"], [type="submit"], [type="reset"], [type="image"]), textarea, select, ' +
    '[role="textbox"], [role="combobox"], [role="searchbox"], [role="spinbutton"]';
  const findings: string[] = [];
  let measured = 0;
  for (const root of roots)
    for (const field of root.querySelectorAll(FIELDS)) {
      if (!field.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if ((field as HTMLInputElement).disabled || field.getAttribute('aria-disabled') === 'true') continue;
      const own = field.getBoundingClientRect();
      if (own.width <= 1 || own.height <= 1) continue;
      // Each element that may draw the boundary, with the box whose outside it is measured against.
      const drawers: { element: Element; holder: Element }[] = [];
      let box: Element | null = field;
      for (let level = 0; box && level <= 3; level++, box = parent(box)) {
        const rect = box.getBoundingClientRect();
        if (rect.width > own.width + 48 || rect.height > own.height + 48) break;
        drawers.push({ element: box, holder: box });
        if (box === field) continue;
        for (const layer of box.querySelectorAll('*')) {
          if (contains(field, layer) || contains(layer, field) || getComputedStyle(layer).position !== 'absolute')
            continue;
          for (const element of [layer, ...layer.querySelectorAll('*')])
            if (element.checkVisibility({ visibilityProperty: true })) drawers.push({ element, holder: box });
        }
      }
      let strongest: { ratio: number; colour: number[]; outside: number[] } | undefined;
      for (const { element, holder } of drawers) {
        const container = parent(holder);
        const outside = container ? behind(container) : [255, 255, 255];
        for (const colour of borders(element)) {
          const drawn = over(colour, behind(element));
          const ratio = contrast(drawn, outside);
          if (!strongest || ratio > strongest.ratio) strongest = { ratio, colour: drawn, outside };
        }
      }
      if (!strongest) continue;
      measured++;
      if (strongest.ratio < 3) {
        const label = field.getAttribute('aria-label') ?? (field as HTMLInputElement).labels?.[0]?.textContent ?? '';
        findings.push(
          `boundary of ${field.localName}${label ? ` "${label.trim().slice(0, 40)}"` : ''} at ` +
            `${strongest.ratio.toFixed(2)}:1, ${rgb(strongest.colour)} on ${rgb(strongest.outside)}`,
        );
      }
    }
  return { findings, measured };
}

/**
 * Icons, focus indicators and selection marks below 3:1 against what they are drawn on, and how many
 * of each were measured. Runs in the page.
 *
 * - Icons. An SVG icon is measured when it is all that identifies the control holding it, because
 *   the control shows no text, or when it carries a name of its own. Its stroke, or its fill where
 *   it has no stroke, is laid over what lies behind it, with the opacity of every ancestor.
 * - Focus. Each enabled control in scope is focused as a keyboard would focus it, and read two
 *   frames later, once a framework has marked it focused. Whatever its focus changes in the
 *   outlines, borders and shadows of the control, of the six boxes around it and of their indicator
 *   layers is the indicator, since only the focus can have changed them. A small input inside a
 *   wider field, such as a time's hour, shows its focus on the field. An outline drawn outside a box
 *   is measured against what lies outside the box, and one drawn inside it, like an inset shadow,
 *   against the box's own fill. A control whose focus changes none of these fails, because a change
 *   of fill alone measures about 1.2:1.
 * - Selection. A selected, pressed or current item is compared with an unselected item of the same
 *   kind in the same group, such as another chip in its chip set. Whatever it draws that the other
 *   does not is its mark, measured the same way: a line, a changed fill against what surrounds the
 *   item, or an icon the other lacks, on the item or on the element around it that draws its state.
 *   A heavier or underlined text counts as a mark of text, which 1.4.3 already measures. An item
 *   whose only difference is a tint fails, because a tint measures about 1.2:1. The current item at
 *   the end of a trail, such as a breadcrumb's last folder, is identified by its position and is not
 *   measured.
 *
 * A disabled control is exempt, as 1.4.11 exempts inactive components.
 */
type Indicator = 'icon' | 'focus' | 'selection';
interface IndicatorFinding {
  kind: Indicator;
  message: string;
  /** The indices of the exceptions whose kind it has and whose selector its element matches. */
  excepted: number[];
}

async function findFaintIndicators({
  scope,
  exclude,
  selected,
  exceptions,
}: {
  /** A selector for the surface to measure within, or null for the whole page. */
  scope: string | null;
  /** Selectors for hosts whose content another suite measures, such as an embedded component. */
  exclude: string[];
  /** Selectors for selected items beyond the ARIA states, such as a component's own class. */
  selected: string[];
  exceptions: { kind: Indicator; target: string }[];
}): Promise<{ measured: Record<Indicator, number>; findings: IndicatorFinding[] }> {
  const elements: Element[] = [];
  const roots: (Document | ShadowRoot)[] = [];
  const collect = (root: Document | ShadowRoot): void => {
    roots.push(root);
    for (const element of root.querySelectorAll('*')) {
      elements.push(element);
      if (element.shadowRoot) collect(element.shadowRoot);
    }
  };
  collect(document);
  // A transition would leave a focused control's computed style at its resting value when it is read.
  const still = new CSSStyleSheet();
  still.replaceSync('*, *::before, *::after { transition: none !important; animation: none !important; }');
  for (const root of roots) root.adoptedStyleSheets = [...root.adoptedStyleSheets, still];
  const parent = (element: Element): Element | null =>
    element.assignedSlot ?? element.parentElement ?? ((element.getRootNode() as ShadowRoot).host || null);
  const contains = (outer: Element, inner: Element): boolean => {
    for (let node: Element | null = inner; node; node = parent(node)) if (node === outer) return true;
    return false;
  };
  const surfaces = scope ? elements.filter((element) => element.matches(scope)) : [];
  const excluded = elements.filter((element) => exclude.some((selector) => element.matches(selector)));
  const within = (element: Element): boolean =>
    (!scope || surfaces.some((outer) => contains(outer, element))) &&
    !excluded.some((outer) => outer !== element && contains(outer, element));
  const style = (element: Element, pseudo?: string): CSSStyleDeclaration => getComputedStyle(element, pseudo);
  const parse = (colour: string): number[] => (colour.match(/[\d.]+/g) ?? []).map(Number);
  const over = ([r, g, b, a = 1]: number[], [br, bg, bb]: number[]): number[] => [
    r * a + br * (1 - a),
    g * a + bg * (1 - a),
    b * a + bb * (1 - a),
  ];
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]: number[]): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const contrast = (a: number[], b: number[]): number => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  const rgb = (colour: number[]): string => `rgb(${colour.slice(0, 3).map(Math.round).join(', ')})`;
  /** The colour behind `element`: its own and its ancestors' fills, laid over white. */
  const behind = (element: Element): number[] => {
    const fills: number[][] = [];
    for (let node: Element | null = element; node; node = parent(node)) {
      const fill = parse(style(node).backgroundColor);
      if ((fill[3] ?? 1) > 0) fills.push(fill);
      if ((fill[3] ?? 1) === 1) break;
    }
    return fills.reduceRight((base, fill) => over(fill, base), [255, 255, 255]);
  };
  const outside = (element: Element): number[] => {
    const container = parent(element);
    return container ? behind(container) : [255, 255, 255];
  };
  const shown = (element: Element): boolean =>
    element.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && element.getClientRects().length > 0;
  const visuallyHidden = (element: Element): boolean => {
    for (let node: Element | null = element; node; node = parent(node)) {
      const box = node.getBoundingClientRect();
      if (
        (box.width <= 1 || box.height <= 1) &&
        (/hidden|clip/.test(style(node).overflowX) || style(node).clipPath !== 'none')
      )
        return true;
    }
    return false;
  };
  const disabled = (element: Element): boolean => {
    for (let node: Element | null = element; node; node = parent(node))
      if ((node as HTMLButtonElement).disabled || node.getAttribute('aria-disabled') === 'true') return true;
    return false;
  };
  const describe = (element: Element): string => {
    const id = element.id ? `#${element.id}` : '';
    const classes = [...element.classList]
      .filter((name) => !name.startsWith('ng-') && !name.startsWith('cdk-'))
      .slice(0, 2)
      .map((name) => `.${name}`)
      .join('');
    const name = element.getAttribute('aria-label') ?? (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    return `${element.localName}${id}${classes}${name ? ` "${name.slice(0, 40)}"` : ''}`;
  };
  const findings: IndicatorFinding[] = [];
  const measured: Record<Indicator, number> = { icon: 0, focus: 0, selection: 0 };
  const report = (kind: Indicator, element: Element, message: string): void => {
    findings.push({
      kind,
      message: `${kind}: ${describe(element)} ${message}`,
      excepted: exceptions.flatMap((exception, index) =>
        exception.kind === kind && element.matches(exception.target) ? [index] : [],
      ),
    });
  };

  /** One line, border or fill something draws, with what it is seen against. */
  interface Drawing {
    what: string;
    raw: string;
    colour: number[];
    against: number[];
  }
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;
  /** What `element`, or one of its pseudo-elements, draws in outline, shadow and border. */
  const drawingsOf = (element: Element, pseudo?: string, label = ''): Drawing[] => {
    const own = style(element, pseudo);
    if (pseudo && (own.content === 'none' || own.content === 'normal')) return [];
    const fill = over(parse(own.backgroundColor), behind(element));
    const out = outside(element);
    const drawings: Drawing[] = [];
    const name = `${label}${pseudo ?? ''}`;
    if (own.outlineStyle !== 'none' && parseFloat(own.outlineWidth) >= 1) {
      const colour = parse(own.outlineColor);
      if ((colour[3] ?? 1) > 0) {
        const against = parseFloat(own.outlineOffset) + parseFloat(own.outlineWidth) <= 0 ? fill : out;
        const raw = `${own.outlineStyle} ${own.outlineWidth} ${own.outlineColor} ${own.outlineOffset}`;
        drawings.push({ what: `${name}outline`, raw, colour: over(colour, against), against });
      }
    }
    for (const [, colour, rest] of own.boxShadow.matchAll(/(rgba?\([^)]*\))([^,]*)/g)) {
      const parsed = parse(colour);
      if ((parsed[3] ?? 1) === 0) continue;
      const against = /inset/.test(rest) ? fill : out;
      drawings.push({ what: `${name}shadow`, raw: `${colour}${rest}`, colour: over(parsed, against), against });
    }
    for (const side of SIDES) {
      const colour = parse(own[`border${side}Color`]);
      if (parseFloat(own[`border${side}Width`]) < 1 || ['none', 'hidden'].includes(own[`border${side}Style`])) continue;
      if ((colour[3] ?? 1) === 0) continue;
      const raw = `${own[`border${side}Style`]} ${own[`border${side}Width`]} ${own[`border${side}Color`]}`;
      drawings.push({ what: `${name}border-${side.toLowerCase()}`, raw, colour: over(colour, fill), against: out });
    }
    if (pseudo) {
      const colour = parse(own.backgroundColor);
      if ((colour[3] ?? 1) > 0) {
        const against = behind(element);
        drawings.push({ what: `${name}fill`, raw: own.backgroundColor, colour: over(colour, against), against });
      }
    }
    return drawings;
  };
  /**
   * What a box draws, with the boxes around it up to `levels` above, and the absolutely positioned
   * layers inside each. A box more than 48px larger each way stops the climb unless `anySize`.
   */
  const drawingsAround = (element: Element, levels: number, anySize = false): Drawing[] => {
    const own = element.getBoundingClientRect();
    const drawings: Drawing[] = [];
    let box: Element | null = element;
    for (let level = 0; box && level <= levels; level++, box = parent(box)) {
      const rect = box.getBoundingClientRect();
      if (!anySize && (rect.width > own.width + 48 || rect.height > own.height + 48)) break;
      const label = level ? `ancestor ${level} ` : '';
      drawings.push(
        ...drawingsOf(box, undefined, label),
        ...drawingsOf(box, '::before', label),
        ...drawingsOf(box, '::after', label),
      );
      for (const layer of box.querySelectorAll('*')) {
        if (style(layer).position !== 'absolute' || !shown(layer)) continue;
        if (level && contains(layer, element)) continue;
        // A layer's pieces are drawn in flow inside it, as an outlined field's outline is.
        [layer, ...layer.querySelectorAll('*')].forEach((piece, index) =>
          drawings.push(
            ...drawingsOf(piece, undefined, `${label}layer ${index} `),
            ...drawingsOf(piece, '::before', `${label}layer ${index} `),
          ),
        );
      }
    }
    return drawings;
  };
  const strongest = (drawings: Drawing[]): (Drawing & { ratio: number }) | undefined =>
    drawings
      .map((drawing) => ({ ...drawing, ratio: contrast(drawing.colour, drawing.against) }))
      .sort((a, b) => b.ratio - a.ratio)[0];
  const signature = (drawing: Drawing): string => `${drawing.what}|${drawing.raw}`;

  // Icons.
  const CONTROLS =
    'button, a[href], summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"]';
  const shownText = (element: Element): boolean => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const holder = node.parentElement;
      if (!holder || !node.textContent?.trim() || holder.closest('svg')) continue;
      if (shown(holder) && !visuallyHidden(holder)) return true;
    }
    return false;
  };
  /** An icon's stroke, or its fill where it has no stroke, with the opacity of every ancestor. */
  const iconColour = (svg: Element): number[] | undefined => {
    let colour: number[] | undefined;
    for (const shape of svg.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse')) {
      const own = style(shape);
      if (own.stroke !== 'none' && parseFloat(own.strokeWidth) > 0) {
        colour = parse(own.stroke);
        colour[3] = (colour[3] ?? 1) * Number(own.strokeOpacity);
        break;
      }
      if (own.fill !== 'none') {
        colour = parse(own.fill);
        colour[3] = (colour[3] ?? 1) * Number(own.fillOpacity);
        break;
      }
    }
    if (!colour) return undefined;
    for (let node: Element | null = svg; node; node = parent(node))
      colour[3] = (colour[3] ?? 1) * Number(style(node).opacity);
    return colour;
  };
  for (const svg of elements) {
    if (svg.localName !== 'svg' || parent(svg)?.closest('svg') || !within(svg) || !shown(svg) || visuallyHidden(svg))
      continue;
    const box = svg.getBoundingClientRect();
    if (box.width < 8 || box.height < 8) continue;
    let control: Element | null = null;
    for (let node: Element | null = svg; node && !control; node = parent(node))
      if (node.matches(CONTROLS)) control = node;
    if (control && disabled(control)) continue;
    const host = parent(svg);
    const named =
      svg.getAttribute('role') === 'img' ||
      svg.hasAttribute('aria-label') ||
      !!svg.querySelector('title') ||
      (!!host && (host.getAttribute('role') === 'img' || host.hasAttribute('aria-label')) && host !== control);
    if (!named && !(control && !shownText(control))) continue;
    const colour = iconColour(svg);
    if (!colour) continue;
    const ground = behind(svg);
    const drawn = over(colour, ground);
    measured.icon++;
    const ratio = contrast(drawn, ground);
    if (ratio < 3) report('icon', control ?? svg, `is ${rgb(drawn)} on ${rgb(ground)}, ${ratio.toFixed(2)}:1`);
  }

  // Selection.
  const SELECTED = [
    '[aria-selected="true"]',
    '[aria-pressed="true"]',
    '[aria-current]:not([aria-current="false"])',
    ...selected,
  ].join(', ');
  const textMarks = (element: Element, sibling: Element | undefined): Drawing[] => {
    if (!sibling) return [];
    const mine = style(element);
    const theirs = style(sibling);
    const heavier = parseFloat(mine.fontWeight) > parseFloat(theirs.fontWeight);
    const underlined = /underline/.test(mine.textDecorationLine) && !/underline/.test(theirs.textDecorationLine);
    if (!heavier && !underlined) return [];
    // Text is held to 4.5:1 by 1.4.3, which axe measures, so a text mark is taken as passing here.
    return [{ what: heavier ? 'heavier text' : 'underline', raw: 'text', colour: [0, 0, 0], against: [255, 255, 255] }];
  };
  /** A changed fill, seen against what surrounds the item, and the icons the sibling lacks. */
  const fillAndIconMarks = (element: Element, sibling: Element | undefined): Drawing[] => {
    const marks: Drawing[] = [];
    const fill = parse(style(element).backgroundColor);
    // With nothing to compare, the item's own fill is its mark if it has one.
    if (sibling ? style(element).backgroundColor !== style(sibling).backgroundColor : (fill[3] ?? 1) > 0)
      marks.push({ what: 'fill', raw: 'fill', colour: behind(element), against: outside(element) });
    if (!sibling) return marks;
    const icons = (node: Element): Element[] => [...node.querySelectorAll('svg')].filter((svg) => shown(svg));
    if (icons(element).length > icons(sibling).length)
      for (const svg of icons(element)) {
        const colour = iconColour(svg);
        if (colour) marks.push({ what: 'icon', raw: 'icon', colour: over(colour, behind(svg)), against: behind(svg) });
      }
    return marks;
  };
  for (const item of elements) {
    if (!item.matches(SELECTED) || item.localName === 'input' || !within(item) || !shown(item) || visuallyHidden(item))
      continue;
    const trailEnd =
      item.hasAttribute('aria-current') &&
      ![...(item.parentElement?.children ?? [])]
        .slice([...(item.parentElement?.children ?? [])].indexOf(item) + 1)
        .some((other) => other.localName === item.localName && shown(other));
    if (trailEnd) continue;
    // The nearest unselected item of the same kind: a sibling, or failing that one in the same group.
    const kind = (other: Element): boolean =>
      other !== item &&
      other.localName === item.localName &&
      other.classList[0] === item.classList[0] &&
      !other.matches(SELECTED) &&
      shown(other);
    let sibling = [...(item.parentElement?.children ?? [])].find(kind);
    for (let group = parent(item), level = 0; !sibling && group && level < 3; group = parent(group), level++)
      sibling = [...group.querySelectorAll(item.localName)].find(kind);
    const theirs = new Set(sibling ? drawingsAround(sibling, 0).map(signature) : []);
    const marks = [
      ...drawingsAround(item, 0).filter((drawing) => !theirs.has(signature(drawing))),
      ...textMarks(item, sibling),
      ...fillAndIconMarks(item, sibling),
    ];
    // A state set on an inner control may be drawn by the element around it, as a chip's is.
    for (
      let mine = parent(item), other = sibling ? parent(sibling) : null, level = 0;
      mine && other && mine !== other && level < 2;
      mine = parent(mine), other = parent(other), level++
    ) {
      const others = new Set(drawingsAround(other, 0).map(signature));
      marks.push(
        ...drawingsAround(mine, 0).filter((drawing) => !others.has(signature(drawing))),
        ...textMarks(mine, other),
        ...fillAndIconMarks(mine, other),
      );
    }
    measured.selection++;
    const best = strongest(marks);
    if (!best) report('selection', item, sibling ? 'looks the same as an unselected sibling' : 'draws no mark');
    else if (best.ratio < 3)
      report(
        'selection',
        item,
        `${best.what} is ${rgb(best.colour)} on ${rgb(best.against)}, ${best.ratio.toFixed(2)}:1`,
      );
  }

  // Focus, last, because it moves focus. Each control is restored to unfocused afterwards.
  const FOCUSABLE =
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const deepActive = (): Element | null => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  const before = deepActive() as HTMLElement | null;
  for (const control of elements) {
    if (
      !control.matches(FOCUSABLE) ||
      !within(control) ||
      !shown(control) ||
      visuallyHidden(control) ||
      disabled(control)
    )
      continue;
    (deepActive() as HTMLElement | null)?.blur();
    const resting = new Set(drawingsAround(control, 6, true).map(signature));
    (control as HTMLElement).focus({ preventScroll: true, focusVisible: true } as FocusOptions);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (deepActive() !== control || !control.matches(':focus-visible')) continue;
    const changed = drawingsAround(control, 6, true).filter((drawing) => !resting.has(signature(drawing)));
    measured.focus++;
    const best = strongest(changed);
    if (!best) report('focus', control, 'changes no outline, border or shadow when focused');
    else if (best.ratio < 3)
      report(
        'focus',
        control,
        `${best.what} is ${rgb(best.colour)} on ${rgb(best.against)}, ${best.ratio.toFixed(2)}:1`,
      );
    (control as HTMLElement).blur();
  }
  before?.focus({ preventScroll: true });
  for (const root of roots) root.adoptedStyleSheets = root.adoptedStyleSheets.filter((sheet) => sheet !== still);

  return { measured, findings };
}

/** The CEE host on the page, which every measured icon, indicator and mark lies within. */
const CEE_HOST = 'cedar-embeddable-editor, cedar-embeddable-field';

/** The findings no exception accounts for. */
const unexplained = (check: Check, findings: string[]): string[] =>
  findings.filter(
    (finding) => !EXCEPTIONS.some((exception) => exception.check === check && exception.finding.test(finding)),
  );

/** Let a layout change settle before measuring it. */
const settle = (page: Page): Promise<void> =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

/** Force WCAG's text spacing on the page and on every shadow root, and let the layout settle. */
const forceTextSpacing = async (page: Page): Promise<void> => {
  await page.evaluate((css) => {
    const roots: (Document | ShadowRoot)[] = [document];
    for (const root of roots)
      for (const element of root.querySelectorAll('*')) if (element.shadowRoot) roots.push(element.shadowRoot);
    for (const root of roots) {
      const style = document.createElement('style');
      style.textContent = css;
      (root instanceof Document ? root.head : root).appendChild(style);
    }
  }, TEXT_SPACING);
  await settle(page);
};

/** The first three checks, each in the viewport it is made in, over what `show` puts on the page. */
const CHECKS: readonly {
  readonly check: Exclude<Check, 'placeholder'>;
  readonly title: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly options: { readonly scrolling: boolean; readonly controls: boolean; readonly text: boolean };
}[] = [
  {
    check: 'reflow',
    title: 'reflows at 320 CSS px',
    viewport: { width: 320, height: 640 },
    options: { scrolling: true, controls: true, text: true },
  },
  {
    check: 'resize',
    title: 'holds at 200% zoom',
    viewport: { width: 640, height: 400 },
    options: { scrolling: false, controls: true, text: true },
  },
  {
    check: 'text spacing',
    title: 'keeps its text whole under WCAG text spacing',
    viewport: { width: 1280, height: 900 },
    options: { scrolling: false, controls: false, text: true },
  },
];

const checkLayout = (title: string, show: (page: Page) => Promise<void>): void => {
  for (const { check, title: checking, viewport, options } of CHECKS)
    test(`${title} ${checking}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await show(page);
      await animationsDone(page);
      if (check === 'text spacing') await forceTextSpacing(page);
      const findings = await page.evaluate(findLayoutProblems, options);
      expect(unexplained(check, findings)).toEqual([]);
    });

  test(`${title} placeholders clear 4.5:1`, async ({ page }) => {
    await show(page);
    await animationsDone(page);
    expect(unexplained('placeholder', await page.evaluate(findFaintPlaceholders))).toEqual([]);
  });

  test(`${title} field boundaries clear 3:1`, async ({ page }) => {
    await show(page);
    await animationsDone(page);
    expect(unexplained('boundary', (await page.evaluate(findFaintBoundaries)).findings)).toEqual([]);
  });

  test(`${title} icons, focus indicators and selection marks clear 3:1`, async ({ page }) => {
    await show(page);
    await animationsDone(page);
    const { findings } = await page.evaluate(findFaintIndicators, {
      scope: CEE_HOST,
      exclude: [],
      selected: [],
      exceptions: [],
    });
    expect(
      unexplained(
        'indicator',
        findings.map((finding) => finding.message),
      ),
    ).toEqual([]);
  });
};

// A selector that stops matching would let the indicator check pass by measuring nothing.
test('the indicator check measures the icons and focus indicators of the input types fixture', async ({ page }) => {
  await show(page, '01-input-types', 'editable');
  await animationsDone(page);
  const { measured } = await page.evaluate(findFaintIndicators, {
    scope: CEE_HOST,
    exclude: [],
    selected: [],
    exceptions: [],
  });
  expect(measured.icon, 'icons').toBeGreaterThan(0);
  expect(measured.focus, 'focus indicators').toBeGreaterThan(0);
});

// A selector that stops matching would let the boundary check pass by measuring nothing.
test('the boundary check measures the fields of the input types fixture', async ({ page }) => {
  await show(page, '01-input-types', 'editable');
  await animationsDone(page);
  expect((await page.evaluate(findFaintBoundaries)).measured).toBeGreaterThan(0);
});

for (const fixture of FIXTURES)
  for (const mode of MODES) checkLayout(`${fixture} ${mode}`, (page) => show(page, fixture, mode));

for (const [fixture, property] of FIELDS)
  for (const mode of MODES)
    checkLayout(`the field element showing ${fixture} ${property} ${mode}`, (page) =>
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

for (const { fixture, instance, values } of LONG_VALUES)
  checkLayout(`${fixture} read only, its values too long for one line,`, async (page) => {
    await serveChanged(page, instance, (json) => Object.assign(json, values));
    await open(page, fixture, 'readonly', instance);
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

/** One of the textarea field's tooltips, opened as a pointer opens it, by resting on its mark. */
const showTooltip = async (page: Page, mark: string, text: string): Promise<void> => {
  await page
    .locator('.non-iterable-component > app-cedar-component-header')
    .filter({ has: page.locator('.title-label', { hasText: /^\s*textarea\b/ }) })
    .locator(mark)
    .hover();
  await expect(page.locator('.mat-mdc-tooltip-surface').filter({ hasText: text })).toBeVisible();
  await animationsDone(page);
};

/**
 * A terminology lookup answers with two terms, the second with a label long enough to wrap, or, when
 * `fails`, fails.
 */
const answerLookups = async (page: Page, fails = false): Promise<void> => {
  await page.route('http://127.0.0.1:9/unused/bioportal/integrated-search', (route) =>
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

/** Each kind of overlay CEE opens, with the fixture it opens over and how it is opened. */
const OVERLAYS: readonly { readonly name: string; readonly show: (page: Page) => Promise<void> }[] = [
  {
    name: "the date picker's calendar in its month view",
    show: async (page) => {
      await open(page, '09-temporal');
      await page.locator('app-date-picker').nth(1).getByRole('button', { name: 'Open calendar' }).click();
      await expect(page.locator('mat-month-view')).toBeVisible();
    },
  },
  {
    name: "the date picker's calendar in its multi-year view",
    show: async (page) => {
      await open(page, '09-temporal');
      await page.locator('app-date-picker').nth(1).getByRole('button', { name: 'Open calendar' }).click();
      await page.locator('.mat-calendar-period-button').click();
      await expect(page.locator('mat-multi-year-view')).toBeVisible();
    },
  },
  {
    name: "a select's open panel",
    show: async (page) => {
      await open(page, '02-choices');
      await page.getByRole('combobox', { name: 'single_list', exact: true }).click();
      await expect(page.getByRole('listbox', { name: 'single_list' })).toBeVisible();
    },
  },
  {
    name: "an autocomplete's suggestions",
    show: async (page) => {
      await answerSearches(page);
      await open(page, '08-authority', 'authority');
      await page.locator('input[aria-label="contributor_orcid"]').pressSequentially('maria', { delay: 20 });
      await passDebounceWindow(page);
      await expect(page.getByRole('option')).toHaveCount(2, { timeout: 5000 });
    },
  },
  {
    name: 'the download menu',
    show: async (page) => {
      await open(page, '01-input-types', undefined, undefined, undefined, '&f=showDownloadMenu');
      await page.getByRole('button', { name: 'Download', exact: true }).click();
      await expect(page.getByRole('menuitem').first()).toBeVisible();
    },
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
  },
  {
    name: "a field's property IRI tooltip",
    show: async (page) => {
      await open(page, '01-input-types');
      await showTooltip(page, '.property-iri', 'https://schema.metadatacenter.org/properties/');
    },
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
  },
  {
    name: "the time zone select's panel",
    show: async (page) => {
      await open(page, '07-timezone');
      await page.locator('cedar-embeddable-editor').getByRole('combobox').click();
      await expect(page.getByRole('option', { name: 'UTC+05:30', exact: true })).toBeVisible();
    },
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
  },
];

for (const overlay of OVERLAYS)
  for (const { check, title, viewport, options } of CHECKS)
    test(`with ${overlay.name} open, the form ${title}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await overlay.show(page);
      await animationsDone(page);
      if (check === 'text spacing') await forceTextSpacing(page);
      const findings = await page.evaluate(findLayoutProblems, options);
      expect(unexplained(check, findings)).toEqual([]);
    });

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
