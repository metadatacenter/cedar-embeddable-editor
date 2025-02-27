import { RorDetailRawResponse } from './ror-detail-raw-response';

export class RorDetailResponse {
  public found: boolean;
  public rawResponse: RorDetailRawResponse;
  public name: string;
  public id: string;
  public requestedId: string;

  constructor(found: boolean, rawResponse: RorDetailRawResponse, name: string, id: string, requestedId: string) {
    this.found = found;
    this.rawResponse = rawResponse;
    this.name = name;
    this.id = id;
    this.requestedId = requestedId;
  }

  static fromJSON(json: any): RorDetailResponse {
    const rawResponse = RorDetailRawResponse.fromJSON(json.rawResponse);
    return new RorDetailResponse(json.found, rawResponse, json.name, json.id, json.requestedId);
  }
}
