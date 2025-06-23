import { PfasSearchResponseItem } from './pfas-search-response-item';

export interface PfasSearchResponse {
  found: boolean;
  results: Array<PfasSearchResponseItem>;
}
