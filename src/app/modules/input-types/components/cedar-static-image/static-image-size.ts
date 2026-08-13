/**
 * How big a static image field renders.
 *
 * The counterpart to `resolveYoutubeSize`, and deliberately not the same shape.
 * A video is an `iframe`: it has no intrinsic size, collapses without one, and
 * so has to fall back to a default. An image knows its own dimensions, so a
 * template that says nothing should get the image at its natural size rather
 * than at a number CEE invented.
 *
 * That is the whole difference, and it is why this returns nulls where the
 * YouTube resolver returns constants: null means "set no attribute", not "use a
 * default".
 */

export interface StaticImageSize {
  width: number | null;
  height: number | null;
}

/**
 * A dimension is usable only if it is a positive, finite number.
 *
 * The model library types these `number | null`, which rules out a string but
 * not a zero, a negative or a `NaN`. Each of those reaches the `width`
 * attribute as something a browser ignores or reads as a collapsed box, and the
 * image is better off at its natural size than at a broken one. Falling back
 * rather than reporting, for the same reason the video resolver does: a
 * wrong-looking size is a template's cosmetic mistake, not something to
 * interrupt someone filling in a form.
 */
const usable = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Each dimension is decided on its own.
 *
 * A template that sets only a width gets its width, and the browser derives the
 * height from the image's aspect ratio — which is a better answer than dropping
 * the width because its partner was missing. `_size` always carries the pair
 * across the corpus, so this is the reading that needs no assumption about what
 * a template author will write.
 */
export const resolveStaticImageSize = (
  width: number | null | undefined,
  height: number | null | undefined,
): StaticImageSize => ({
  width: usable(width) ? width : null,
  height: usable(height) ? height : null,
});
