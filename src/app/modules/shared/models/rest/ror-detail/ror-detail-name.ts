export class RorName {
  public lang: string;
  public types: string[];
  public value: string;

  constructor(lang: string, types: string[], value: string) {
    this.lang = lang;
    this.types = types;
    this.value = value;
  }

  static fromJSON(json: any): RorName {
    return new RorName(json.lang, json.types, json.value);
  }
}
