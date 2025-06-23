export class PfasDetailResponse {
  public found: boolean;
  public name: string;
  public id: string;
  public requestedId: string;

  constructor(found: boolean, name: string, id: string, requestedId: string) {
    this.found = found;
    this.name = name;
    this.id = id;
    this.requestedId = requestedId;
  }

  static fromJSON(json: any): PfasDetailResponse {
    return new PfasDetailResponse(json.found, json.name, json.id, json.requestedId);
  }
}
