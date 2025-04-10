export class ExternalId {
  public all: string[];
  public preferred: string | null;
  public type: string;

  constructor(all: string[], preferred: string | null, type: string) {
    this.all = all;
    this.preferred = preferred;
    this.type = type;
  }

  static fromJSON(json: any): ExternalId {
    return new ExternalId(json.all, json.preferred, json.type);
  }
}
