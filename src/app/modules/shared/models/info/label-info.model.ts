export class LabelInfo {
  /**
   * All three nullable: the library types a template's `schema:name` and
   * `schema:description` as `NullableString`, because a template is free to omit
   * either, and CEE renders them through `?.` rather than requiring them.
   * `skos:prefLabel` is rarer still — most fields have none.
   */
  preferredLabel: string | null = null;
  description: string | null = null;
  label: string | null = null;
}
