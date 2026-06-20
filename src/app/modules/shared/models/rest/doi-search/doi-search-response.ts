import { DoiSearchResponseItem } from './doi-search-response-item';

export interface DoiSearchResponse {
  found: boolean;
  results: Array<DoiSearchResponseItem>;
}
