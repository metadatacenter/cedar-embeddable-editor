/**
 * How big a static YouTube field renders.
 *
 * A template can ask, through `_ui._size`, and until now CEE did not listen: the
 * component carried `640 × 390` as two readonly fields and every video was that
 * size whatever the template said. The corpus asks for `400 × 300` six times and
 * `192 × 108` four times, so the setting is used and was being discarded.
 *
 * The defaults stay exactly what those fields held, so a template that says
 * nothing renders as it always has.
 */

/** What the component had hard-coded, and what a silent template still gets. */
export const DEFAULT_YOUTUBE_SIZE = { width: 640, height: 390 } as const;

export interface YoutubeSize {
  width: number;
  height: number;
}

/**
 * A dimension is usable only if it is a positive, finite number.
 *
 * The model library types these `number | null`, which rules out a string but
 * not a zero, a negative or a `NaN` — and each of those reaches the `width`
 * attribute as something the browser reads as "no size" or ignores outright,
 * collapsing the player. Anything not usable falls back rather than being
 * reported: a wrong-looking size is a template's cosmetic mistake, not
 * something to interrupt someone filling in a form.
 */
const usable = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Each dimension falls back on its own.
 *
 * A template that sets only a width gets its width and the default height,
 * rather than losing both to an all-or-nothing rule. That cannot happen in the
 * corpus, where `_size` always carries the pair, but it is the reading that
 * needs no assumption about what a template author will write.
 */
export const resolveYoutubeSize = (
  width: number | null | undefined,
  height: number | null | undefined,
): YoutubeSize => ({
  width: usable(width) ? width : DEFAULT_YOUTUBE_SIZE.width,
  height: usable(height) ? height : DEFAULT_YOUTUBE_SIZE.height,
});
