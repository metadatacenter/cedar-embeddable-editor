export class NihGrantDetailResponse {
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

  static fromJSON(json: any): NihGrantDetailResponse {
    return new NihGrantDetailResponse(json.found, json.name, json.id, json.requestedId);
  }
}
