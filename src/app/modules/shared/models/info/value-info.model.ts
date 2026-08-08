import { InstanceObject } from '../instance-node.model';

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
   * A field's declared default. A literal field's is text; a controlled, ORCID or
   * ROR field's is the term node itself, carrying `@id` and `rdfs:label`. It was
   * declared `string` while three components indexed it as an object.
   */
  defaultValue: string | InstanceObject | null = null;
  minLength: number | null = null;
  maxLength: number | null = null;
  temporalType: string | null = null;
  /**
   * `_valueConstraints.regex`. Present in templates — 150 occurrences across the
   * HuBMAP corpus — but historically never read, so no consumer could apply it.
   */
  regex: string | null = null;
}
