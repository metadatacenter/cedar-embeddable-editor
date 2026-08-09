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
   * Only YouTube fills these in. The model library models `width` and `height`
   * on `StaticYoutubeField` and not on `StaticImageField`, so an image's
   * `_size` is dropped before CEE can see it — see the model library items on
   * the roadmap. Reading it out of the raw JSON instead would work and is
   * deliberately not done: the parser's claim is that a template read from YAML
   * gives the same tree, and that claim ends the moment it reaches for a JSON
   * key.
   */
  width: number | null = null;
  height: number | null = null;
}
