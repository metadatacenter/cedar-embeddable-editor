import { OrcidSearchResponseItem } from './orcid-search-response-item';

export interface OrcidSearchResponse {
  found: boolean;
  results: Array<OrcidSearchResponseItem>;
}
