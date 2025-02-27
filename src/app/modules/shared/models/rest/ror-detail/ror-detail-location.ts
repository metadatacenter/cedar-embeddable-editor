import { GeonamesDetails } from './ror-detail-geoname-details';

export class Location {
  public geonames_details: GeonamesDetails;
  public geonames_id: number;

  constructor(geonames_details: GeonamesDetails, geonames_id: number) {
    this.geonames_details = geonames_details;
    this.geonames_id = geonames_id;
  }

  static fromJSON(json: any): Location {
    return new Location(GeonamesDetails.fromJSON(json.geonames_details), json.geonames_id);
  }
}
