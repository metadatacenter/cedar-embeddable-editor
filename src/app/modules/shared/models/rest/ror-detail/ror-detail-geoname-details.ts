export class GeonamesDetails {
  public continent_code: string;
  public continent_name: string;
  public country_code: string;
  public country_name: string;
  public country_subdivision_code: string;
  public country_subdivision_name: string;
  public lat: number;
  public lng: number;
  public name: string;

  constructor(
    continent_code: string,
    continent_name: string,
    country_code: string,
    country_name: string,
    country_subdivision_code: string,
    country_subdivision_name: string,
    lat: number,
    lng: number,
    name: string,
  ) {
    this.continent_code = continent_code;
    this.continent_name = continent_name;
    this.country_code = country_code;
    this.country_name = country_name;
    this.country_subdivision_code = country_subdivision_code;
    this.country_subdivision_name = country_subdivision_name;
    this.lat = lat;
    this.lng = lng;
    this.name = name;
  }

  static fromJSON(json: any): GeonamesDetails {
    return new GeonamesDetails(
      json.continent_code,
      json.continent_name,
      json.country_code,
      json.country_name,
      json.country_subdivision_code,
      json.country_subdivision_name,
      json.lat,
      json.lng,
      json.name,
    );
  }
}
