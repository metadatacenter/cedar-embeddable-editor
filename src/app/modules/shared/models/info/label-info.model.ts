export class LabelInfo {
  /** An explicit label for this use of the field in its parent template. */
  deploymentLabel: string | null = null;
  /**
   * All three nullable: the library types a template's `schema:name` and
   * `schema:description` as `NullableString`, because a template is free to omit
   * either, and CEE renders them through `?.` rather than requiring them.
   * `skos:prefLabel` is rarer still — most fields have none.
   */
  preferredLabel: string | null = null;
  description: string | null = null;
  label: string | null = null;
  /**
   * The language this text is written in, or null where nothing declares one. A template or element
   * declares the language of its own text with `@language` in its `@context`. Its children's labels
   * and descriptions are its text too, so each component takes the language of the nearest template
   * or element that declares one. A field's own `@language` is the language of its values, and does
   * not apply here. Held as written: a component reads it as a language tag.
   */
  language: string | null = null;
}
