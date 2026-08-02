export class Numbers {
  static PATTERN_XSD_INT_AND_LONG = '[+-]?(0|[1-9][0-9]*)';
  static PATTERN_XSD_FLOAT_AND_DOUBLE = '([+-]?((0|[1-9][0-9]*)(\\.[0-9]{0,maxDig})?|\\.[0-9]{0,maxDig}))';
  /** xsd:decimal has no exponent form, unlike float and double. */
  static PATTERN_XSD_DECIMAL = '([+-]?((0|[1-9][0-9]*)(\\.[0-9]{0,maxDig})?|\\.[0-9]{0,maxDig}))';
  static NUMBER_INT_MAX = 2147483647;
  static NUMBER_INT_MIN = -2147483648;
  static NUMBER_LONG_MAX = 9223372036854775807;
  static NUMBER_LONG_MIN = -9223372036854775808;
  static NUMBER_BYTE_MAX = 127;
  static NUMBER_BYTE_MIN = -128;
  static NUMBER_SHORT_MAX = 32767;
  static NUMBER_SHORT_MIN = -32768;
}
