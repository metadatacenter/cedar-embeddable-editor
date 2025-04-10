import { RorSearchResponseItem } from './ror-search-response-item';

export interface RorSearchResponse {
  found: boolean;
  results: Array<RorSearchResponseItem>;
}
