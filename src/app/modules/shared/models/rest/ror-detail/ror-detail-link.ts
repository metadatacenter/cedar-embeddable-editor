export class Link {
  public type: string;
  public value: string;

  constructor(type: string, value: string) {
    this.type = type;
    this.value = value;
  }

  static fromJSON(json: any): Link {
    return new Link(json.type, json.value);
  }
}
