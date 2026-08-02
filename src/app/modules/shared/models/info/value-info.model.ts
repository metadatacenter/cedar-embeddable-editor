export class ValueInfo {
  requiredValue: boolean;
  defaultValue: string;
  minLength: number;
  maxLength: number;
  temporalType: string;
  /**
   * `_valueConstraints.regex`. Present in templates — 150 occurrences across the
   * HuBMAP corpus — but historically never read, so no consumer could apply it.
   */
  regex: string;
}
