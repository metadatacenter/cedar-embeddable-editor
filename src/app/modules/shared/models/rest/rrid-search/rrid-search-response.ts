import { RridSearchResponseItem } from './rrid-search-response-item';

export interface RridSearchResponse {
  found: boolean;
  results: Array<RridSearchResponseItem>;
}
