export class LabelInfo {
  preferredLabel: string;
  /**
   * Both nullable: the library types a template's `schema:name` and
   * `schema:description` as `NullableString`, because a template is free to omit
   * either, and CEE renders them through `?.` rather than requiring them.
   */
  description: string | null;
  label: string | null;
}
