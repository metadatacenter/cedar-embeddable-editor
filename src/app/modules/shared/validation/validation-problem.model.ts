/**
 * One thing wrong with one value.
 *
 * The data quality report previously reported two integers and a boolean, which
 * told an embedder that something was missing but never what. A problem list
 * lets the host point the user at a field.
 */
export class ValidationProblem {
  constructor(
    /** Component path from the template root, e.g. `['_author', '_email']`. */
    public readonly path: string[],
    /** The field's property name — the last path segment. */
    public readonly field: string,
    /** `_ui.inputType` of the field the problem belongs to. */
    public readonly inputType: string,
    /** Stable machine-readable kind, e.g. `minLength`, `pattern`, `maxItems`. */
    public readonly code: string,
    /** Human-readable description. Not translated: these are diagnostics, not UI copy. */
    public readonly message: string,
    /** The offending value, when there is one. */
    public readonly value: unknown = null,
  ) {}
}

/** Problem codes, so consumers can branch without matching on message text. */
export class ValidationCode {
  static required = 'required';
  static minLength = 'minLength';
  static maxLength = 'maxLength';
  static regex = 'regex';
  static email = 'email';
  static link = 'link';
  static phoneNumber = 'phoneNumber';
  static numberType = 'numberType';
  static minValue = 'minValue';
  static maxValue = 'maxValue';
  static decimalPlace = 'decimalPlace';
  static temporalType = 'temporalType';
  static temporalGranularity = 'temporalGranularity';
  static temporalCalendar = 'temporalCalendar';
  static timezone = 'timezone';
  static choiceMembership = 'choiceMembership';
  static controlledStructure = 'controlledStructure';
  static iriMalformed = 'iriMalformed';
  static minItems = 'minItems';
  static maxItems = 'maxItems';
}
