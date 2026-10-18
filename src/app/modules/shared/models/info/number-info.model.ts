import type { NumericValue } from 'cedar-model-typescript-library';
/** A numeric field's constraints. Null throughout for the reason given on `ValueInfo`. */
export class NumberInfo {
  numberType: string | null = null;
  unitOfMeasure: string | null = null;
  minValue: NumericValue | null = null;
  maxValue: NumericValue | null = null;
  decimalPlace: number | null = null;
}
