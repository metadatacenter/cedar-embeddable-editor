/** A numeric field's constraints. Null throughout for the reason given on `ValueInfo`. */
export class NumberInfo {
  numberType: string | null = null;
  unitOfMeasure: string | null = null;
  minValue: number | null = null;
  maxValue: number | null = null;
  decimalPlace: number | null = null;
}
