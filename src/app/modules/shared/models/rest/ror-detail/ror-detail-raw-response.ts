import { ExternalId } from './ror-detail-external-id';
import { Link } from './ror-detail-link';
import { Location } from './ror-detail-location';
import { RorName } from './ror-detail-name';
import { Relationship } from './ror-detail-relationship';

export class RorDetailRawResponse {
  public established: number;
  public external_ids: ExternalId[];
  public id: string;
  public links: Link[];
  public locations: Location[];
  public names: RorName[];
  public relationships: Relationship[];
  public status: string;
  public types: string[];

  constructor(
    established: number,
    external_ids: ExternalId[],
    id: string,
    links: Link[],
    locations: Location[],
    names: RorName[],
    relationships: Relationship[],
    status: string,
    types: string[],
  ) {
    this.established = established;
    this.external_ids = external_ids;
    this.id = id;
    this.links = links;
    this.locations = locations;
    this.names = names;
    this.relationships = relationships;
    this.status = status;
    this.types = types;
  }

  static fromJSON(json: any): RorDetailRawResponse {
    const established = json.established;
    const external_ids = (json.external_ids || []).map((item: any) => ExternalId.fromJSON(item));
    const id = json.id;
    const links = (json.links || []).map((item: any) => Link.fromJSON(item));
    const locations = (json.locations || []).map((item: any) => Location.fromJSON(item));
    const names = (json.names || []).map((item: any) => RorName.fromJSON(item));
    const relationships = (json.relationships || []).map((item: any) => Relationship.fromJSON(item));
    const status = json.status;
    const types = json.types;
    return new RorDetailRawResponse(
      established,
      external_ids,
      id,
      links,
      locations,
      names,
      relationships,
      status,
      types,
    );
  }
}
