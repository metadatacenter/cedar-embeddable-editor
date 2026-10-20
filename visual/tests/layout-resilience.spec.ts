import { expect, test, type Page } from '@playwright/test';
import { open } from './support/host';

/**
 * WCAG 1.4.10 Reflow, 1.4.4 Resize Text, 1.4.12 Text Spacing and, for placeholders, 1.4.3 Contrast
 * (Minimum). The four CEDAR browser components check these the same way.
 *
 * - Reflow. At 320 CSS px wide, neither the page nor a scroll container of CEE's scrolls
 *   sideways, and every control can be reached.
 * - Resize. In a 640 by 400 CSS px viewport, which is a 1280 by 800 window at 200% zoom, no text is
 *   clipped or overlaps other text, and every control can be reached.
 * - Text spacing. With WCAG's line, letter, word and paragraph spacing forced on the page and on
 *   every shadow root, at 1280 px wide, no text is clipped or overlaps other text.
 * - Placeholders. Every placeholder clears 4.5:1 against the background it sits on. axe does not
 *   measure placeholder text.
 *
 * Each runs over the input types, choices, authority and temporal fixtures, a nested one and a
 * multi-page one, editable and read only. A finding that cannot be fixed without a visible change is
 * listed in `EXCEPTIONS` with the change it needs.
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

const TEXT_SPACING =
  '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } ' +
  'p { margin-bottom: 2em !important; }';

type Check = 'reflow' | 'resize' | 'text spacing' | 'placeholder';

interface Exception {
  readonly check: Check;
  /** Matched against the finding, which names the element by its tag, classes and text. */
  readonly finding: RegExp;
  /** The visible change that would remove the finding. */
  readonly needs: string;
}

/** Findings that need a visible change, each with the change it needs. */
const EXCEPTIONS: readonly Exception[] = [];

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
   */
  const clippers = (element: Element): { ancestor: Element; box: Partial<Box> }[] => {
    const found: { ancestor: Element; box: Partial<Box> }[] = [];
    for (
      let ancestor: Element | null = element;
      ancestor && ancestor !== document.documentElement;
      ancestor = parentOf(ancestor)
    ) {
      const style = getComputedStyle(ancestor);
      const x = style.overflowX === 'hidden' || style.overflowX === 'clip';
      const y = style.overflowY === 'hidden' || style.overflowY === 'clip';
      if ((!x && !y) || style.display === 'inline' || style.display === 'contents') continue;
      const frame = ancestor.getBoundingClientRect();
      const left = frame.left + ancestor.clientLeft;
      const top = frame.top + ancestor.clientTop;
      found.push({
        ancestor,
        box: {
          ...(x ? { left, right: left + ancestor.clientWidth } : {}),
          ...(y ? { top, bottom: top + ancestor.clientHeight } : {}),
        },
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
          (element) => getComputedStyle(element).textOverflow === 'ellipsis',
        );
        // An ellipsis is a clip a reader is told about, and a title or a tooltip gives the rest.
        const elsewhere = text.element.closest('[title], .mat-mdc-tooltip-trigger') !== null;
        if (!(ellipsis && elsewhere))
          findings.push(
            `text is clipped: ${name(text.element)}${ellipsis ? ' behind an ellipsis' : ''} by ${name(clipper.ancestor)}`,
          );
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
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const [a, b] = [texts[i], texts[j]];
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        if (a.rects.some((one) => b.rects.some((other) => overlap(one, other))))
          findings.push(`text overlaps: ${name(a.element)} and ${name(b.element)}`);
      }
  }

  return findings;
}

/** Placeholders below 4.5:1 on what they sit on. Runs in the page. */
function findFaintPlaceholders(): string[] {
  const root = document.querySelector('cedar-embeddable-editor')!.shadowRoot!;
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

for (const fixture of FIXTURES)
  for (const mode of MODES) {
    test(`${fixture} ${mode} reflows at 320 CSS px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await show(page, fixture, mode);
      const findings = await page.evaluate(findLayoutProblems, { scrolling: true, controls: true, text: false });
      expect(unexplained('reflow', findings)).toEqual([]);
    });

    test(`${fixture} ${mode} holds at 200% zoom`, async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 400 });
      await show(page, fixture, mode);
      const findings = await page.evaluate(findLayoutProblems, { scrolling: false, controls: true, text: true });
      expect(unexplained('resize', findings)).toEqual([]);
    });

    test(`${fixture} ${mode} keeps its text whole under WCAG text spacing`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await show(page, fixture, mode);
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
      const findings = await page.evaluate(findLayoutProblems, { scrolling: false, controls: false, text: true });
      expect(unexplained('text spacing', findings)).toEqual([]);
    });

    test(`${fixture} ${mode} placeholders clear 4.5:1`, async ({ page }) => {
      await show(page, fixture, mode);
      expect(unexplained('placeholder', await page.evaluate(findFaintPlaceholders))).toEqual([]);
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
