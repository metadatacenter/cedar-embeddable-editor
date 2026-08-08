/**
 * How many occurrences a multi field or element may hold.
 *
 * Null for a bound the template does not declare — which `getSafeMinItems` has
 * always tested for, against a declaration that said the value was a number.
 */
export class MultiInfo {
  minItems: number | null = null;
  maxItems: number | null = null;

  getSafeMinItems(): number {
    return this.minItems ?? 0;
  }
}
