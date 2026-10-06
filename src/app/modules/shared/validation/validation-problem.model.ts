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
    /** `_ui.inputType` of the field the problem belongs to, or null for a field that declares none. */
    public readonly inputType: string | null,
    /** Stable machine-readable kind, e.g. `minLength`, `pattern`, `maxItems`. */
    public readonly code: string,
    /** Human-readable description. Not translated: these are diagnostics, not UI copy. */
    public readonly message: string,
    /** The offending value, when there is one. */
    public readonly value: unknown = null,
    /**
     * The entry taken at each repeating component along `path`, outermost first.
     *
     * A field or element that repeats is listed for each of its entries, so a path
     * names one place per entry of everything above it, and this says which. A
     * problem about a whole list, such as `minItems`, names the entries above the
     * list but none of its own. A `required` problem names its containing elements:
     * at least one value must be supplied in each existing parent.
     */
    public readonly occurrences: number[] = [],
    /** Missing answers are warnings; malformed answers and unfinished edits are errors. Both affect isValid. */
    public readonly severity: 'warning' | 'error' = code === 'required' || code === 'minItems' ? 'warning' : 'error',
  ) {}

  /** The same problem, located in these entries. */
  at(occurrences: number[]): ValidationProblem {
    return new ValidationProblem(
      this.path,
      this.field,
      this.inputType,
      this.code,
      this.message,
      this.value,
      occurrences,
      this.severity,
    );
  }
}

/** Problem codes, so consumers can branch without matching on message text. */
export class ValidationCode {
  static required = 'required';
  static valueShape = 'valueShape';
  static attributeName = 'attributeName';
  static incompleteValue = 'incompleteValue';
  static templateConstraint = 'templateConstraint';
  static templateMismatch = 'templateMismatch';
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
  /** An offset shaped `±HH:MM` but outside XML Schema's range, such as `+05:60`. */
  static timezoneOffset = 'timezoneOffset';
  static choiceMembership = 'choiceMembership';
  static controlledStructure = 'controlledStructure';
  static iriMalformed = 'iriMalformed';
  static minItems = 'minItems';
  static maxItems = 'maxItems';
}
