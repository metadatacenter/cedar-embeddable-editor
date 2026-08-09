/**
 * Which number wins when a template asks an image to be a size.
 *
 * The image half of the pair `static-youtube-size.spec.ts` holds for video, and
 * the interesting difference is the absent case. A video has to be given a size
 * because an `iframe` has none of its own; an image has, so saying nothing is a
 * usable answer and the resolver returns null rather than a default. Null means
 * the attribute is left off entirely.
 *
 * The rules here are arithmetic and need no template. That the number survives
 * the trip from `_ui._size` through the model library into CEE's tree is a
 * different claim, and `harness/test/static-content-size.spec.ts` holds it.
 */
import { describe, expect, it } from 'vitest';
import { resolveStaticImageSize } from './static-image-size';

describe('the size a template asks an image to be', () => {
  it('is used when both dimensions are usable', () => {
    expect(resolveStaticImageSize(300, 200)).toEqual({ width: 300, height: 200 });
  });

  /** No default: the browser already knows how big the image is. */
  it('is left to the image when the template says nothing', () => {
    expect(resolveStaticImageSize(null, null)).toEqual({ width: null, height: null });
    expect(resolveStaticImageSize(undefined, undefined)).toEqual({ width: null, height: null });
  });

  /**
   * The model library types these `number | null`, which rules out a string but
   * not any of these. Each reaches the `width` attribute as something a browser
   * ignores or reads as a collapsed box — worse than the image's own size.
   */
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('ignores %p', (bad) => {
    expect(resolveStaticImageSize(bad, bad)).toEqual({ width: null, height: null });
  });

  /**
   * Each dimension falls back on its own, so a width with no height keeps the
   * width and lets the browser derive the rest from the aspect ratio.
   */
  it('keeps a dimension whose partner is missing', () => {
    expect(resolveStaticImageSize(300, null)).toEqual({ width: 300, height: null });
    expect(resolveStaticImageSize(null, 200)).toEqual({ width: null, height: 200 });
  });
});
