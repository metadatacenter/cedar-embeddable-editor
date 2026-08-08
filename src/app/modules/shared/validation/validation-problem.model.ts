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
    /** Null for a field that declares no `_ui.inputType`. */
    public readonly inputType: string | null,
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
  /**
   * A multi child's array is absent from the instance, or is `null` rather than an
   * array.
   *
   * Distinct from `minItems`, which is about how many entries an array that *is*
   * there holds. CEDAR lists a multi child in its parent's JSON Schema `required`
   * array independently of any `minItems`, so the property has to be present even
   * when the floor is zero or absent — and `[]` satisfies that where `null` does
   * not.
   *
   * The canonical validator raises two separate errors here, `object has missing
   * required properties` and `null found, array expected`. They are one code with
   * a distinguishing message, since the verdict is the same and a consumer that
   * wants to tell them apart has the message.
   */
  static missingProperty = 'missingProperty';
}
