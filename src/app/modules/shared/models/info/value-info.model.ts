import { AuthorityTerm } from '../authority/authority-search-response.model';

/**
 * A field's `_valueConstraints`, as far as CEE reads them.
 *
 * Every field is null when the template does not declare it. The parser fills this
 * in from a `valueConstraints` it holds as `any`, so an undeclared constraint
 * arrived as `undefined` while the declaration promised a value — and each of the
 * nine readers was left to decide for itself what a missing minimum meant.
 * Normalised to null at the one place that knows, which is the parser.
 */
export class ValueInfo {
  requiredValue = false;
  /**
   * A field's declared default. A literal field's is text; a controlled field's is
   * a term; a boolean field's is `true` or `false`. It was declared `string` while
   * three components indexed it as an object, and the boolean case arrived through
   * the parser's untyped read of `valueConstraints` — so the declaration named one
   * of the three shapes that reach it.
   *
   * The instance builder narrows it once when it seeds a new instance: literal
   * defaults become literal atoms, and term defaults become an IRI/label atom.
   * Widgets only display the instance and never apply this declaration themselves.
   *
   * Null for an ORCID or ROR field whatever the template declares. The model
   * library gives those kinds — and email, link and phone-number — an empty
   * constraint object, so a default declared on one never reaches here.
   */
  defaultValue: string | boolean | AuthorityTerm | null = null;
  minLength: number | null = null;
  maxLength: number | null = null;
  temporalType: string | null = null;
  /**
   * `_valueConstraints.regex`. Present in templates — 150 occurrences across the
   * HuBMAP corpus — but historically never read, so no consumer could apply it.
   */
  regex: string | null = null;
}
