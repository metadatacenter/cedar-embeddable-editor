import { InstanceObject } from '../instance-node.model';
export class ValueInfo {
  requiredValue: boolean;
  /**
   * A field's declared default. A literal field's is text; a controlled, ORCID or
   * ROR field's is the term node itself, carrying `@id` and `rdfs:label`. It was
   * declared `string` while three components indexed it as an object.
   */
  defaultValue: string | InstanceObject | null;
  minLength: number;
  maxLength: number;
  temporalType: string;
  /**
   * `_valueConstraints.regex`. Present in templates — 150 occurrences across the
   * HuBMAP corpus — but historically never read, so no consumer could apply it.
   */
  regex: string;
}
