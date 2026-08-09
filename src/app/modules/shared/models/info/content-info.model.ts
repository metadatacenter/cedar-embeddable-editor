export class ContentInfo {
  content = '';

  /**
   * The size a template asks a static field to render at, from `_ui._size`.
   *
   * Null when the template says nothing, which is most of the time — so these
   * are a request rather than a measurement, and each renderer decides what to
   * do when they are absent. Numbers, in CSS pixels: every `_size` across the
   * 579 corpus templates is `{width, height}` with both present and both plain
   * numbers, so nothing here parses units.
   *
   * Filled in for the two kinds that can be sized, YouTube and image. The model
   * library modelled `width` and `height` on `StaticYoutubeField` alone until
   * 0.9.2-dev.20260808.92f3412, so an image's `_size` used to be dropped before
   * CEE could see it. Reading it out of the raw JSON instead would have worked
   * and was deliberately not done: the parser's claim is that a template read
   * from YAML gives the same tree, and that claim ends the moment it reaches for
   * a JSON key.
   *
   * The two renderers answer an absent size differently, and both are right. A
   * video is an `iframe`, which has no intrinsic size and collapses without one,
   * so it falls back to a default. An image has its own dimensions, so it is
   * left to render at them.
   */
  width: number | null = null;
  height: number | null = null;
}
