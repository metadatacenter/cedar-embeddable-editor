export class Relationship {
  public label: string;
  public type: string;
  public id: string;

  constructor(label: string, type: string, id: string) {
    this.label = label;
    this.type = type;
    this.id = id;
  }

  static fromJSON(json: any): Relationship {
    return new Relationship(json.label, json.type, json.id);
  }
}
