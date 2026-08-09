/**
 * Which number wins when a template asks a video to be a size.
 *
 * `_ui._size` was read by nobody: the component carried `640 × 390` as two
 * readonly fields, so every video rendered at that size whatever the template
 * said. The corpus asks for `400 × 300` six times and `192 × 108` four times,
 * so the setting is used and was being discarded.
 *
 * The rules here are arithmetic and need no template. That the number survives
 * the trip from `_ui._size` through the model library into CEE's tree is a
 * different claim, and `harness/test/static-content-size.spec.ts` holds it.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_YOUTUBE_SIZE, resolveYoutubeSize } from './static-youtube-size';

describe('the size a template asks a video to be', () => {
  it('is used when both dimensions are usable', () => {
    expect(resolveYoutubeSize(400, 300)).toEqual({ width: 400, height: 300 });
  });

  it('is the size CEE has always used when the template says nothing', () => {
    expect(resolveYoutubeSize(null, null)).toEqual({ ...DEFAULT_YOUTUBE_SIZE });
    expect(resolveYoutubeSize(undefined, undefined)).toEqual({ ...DEFAULT_YOUTUBE_SIZE });
  });

  /**
   * The model library types these `number | null`, which rules out a string but
   * not any of these. Each reaches the `width` attribute as something a browser
   * reads as "no size" or ignores, collapsing the player — a worse outcome than
   * a size the template did not ask for.
   */
  it('falls back for a number that cannot be a size', () => {
    expect(resolveYoutubeSize(0, 300).width).toBe(DEFAULT_YOUTUBE_SIZE.width);
    expect(resolveYoutubeSize(-10, 300).width).toBe(DEFAULT_YOUTUBE_SIZE.width);
    expect(resolveYoutubeSize(Number.NaN, 300).width).toBe(DEFAULT_YOUTUBE_SIZE.width);
    expect(resolveYoutubeSize(Number.POSITIVE_INFINITY, 300).width).toBe(DEFAULT_YOUTUBE_SIZE.width);
  });

  /** Losing a good height to a bad width would be an assumption, not a rule. */
  it('falls back a dimension at a time, not as a pair', () => {
    expect(resolveYoutubeSize(0, 300)).toEqual({ width: DEFAULT_YOUTUBE_SIZE.width, height: 300 });
    expect(resolveYoutubeSize(400, null)).toEqual({ width: 400, height: DEFAULT_YOUTUBE_SIZE.height });
  });
});
