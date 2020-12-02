export class MultiInfo {

  minItems: number;
  maxItems: number;

  getSafeMinItems(): number {
    return this.minItems === null ? 0 : this.minItems;
  }

}
