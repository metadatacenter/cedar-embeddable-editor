export class Numbers {
  static PATTERN_XSD_INT_AND_LONG = '[+-]?(0|[1-9][0-9]*)';
  static PATTERN_XSD_FLOAT_AND_DOUBLE = '([+-]?((0|[1-9][0-9]*)(\\.[0-9]{0,maxDig})?|\\.[0-9]{0,maxDig}))';
  /** xsd:decimal has no exponent form, unlike float and double. */
  static PATTERN_XSD_DECIMAL = '([+-]?((0|[1-9][0-9]*)(\\.[0-9]{0,maxDig})?|\\.[0-9]{0,maxDig}))';
  /**
   * Bounds of the integral XSD types, as BigInt.
   *
   * BigInt rather than number because xsd:long reaches 2^63-1, which has no exact IEEE-754
   * double representation: as a numeric literal it rounds up to 2^63. A range check against
   * that rounded value accepted 9223372036854775808 — one past the real maximum — and could
   * not distinguish 9223372036854775807 from 9223372036854775809 at all, both being the same
   * double. BigInt is exact at every width, so the bounds are the bounds.
   *
   * Compare against these with BigInt; coercing them back to number reintroduces the bug.
   */
  static NUMBER_INT_MAX = 2147483647n;
  static NUMBER_INT_MIN = -2147483648n;
  static NUMBER_LONG_MAX = 9223372036854775807n;
  static NUMBER_LONG_MIN = -9223372036854775808n;
  static NUMBER_BYTE_MAX = 127n;
  static NUMBER_BYTE_MIN = -128n;
  static NUMBER_SHORT_MAX = 32767n;
  static NUMBER_SHORT_MIN = -32768n;
}
