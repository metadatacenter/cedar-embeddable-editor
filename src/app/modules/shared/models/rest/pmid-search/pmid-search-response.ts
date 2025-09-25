import { PmidSearchResponseItem } from './pmid-search-response-item';

export interface PmidSearchResponse {
  found: boolean;
  results: Array<PmidSearchResponseItem>;
}
