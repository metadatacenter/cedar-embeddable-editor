import { NihGrantSearchResponseItem } from './nih-grant-search-response-item';

export interface NihGrantSearchResponse {
  found: boolean;
  results: Array<NihGrantSearchResponseItem>;
}
