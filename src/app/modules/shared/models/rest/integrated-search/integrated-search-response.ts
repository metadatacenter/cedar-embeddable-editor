import {IntegratedSearchResponseItem} from './integrated-search-response-item';

export class IntegratedSearchResponse {

  page: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  prevPage: object;
  nextPage: object;
  collection: Array<IntegratedSearchResponseItem>;

}
