import { IntegratedSearchResponseItem } from './integrated-search-response-item';

/**
 * What the terminology server's integrated search answers with.
 *
 * An interface rather than a class: nothing constructs one. It exists as the type
 * argument to `http.post`, describing JSON that arrives — and a class there
 * carries an initialisation obligation for fields no constructor will ever set.
 */
export interface IntegratedSearchResponse {
  page: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  prevPage: object;
  nextPage: object;
  /**
   * Optional, because the endpoint answers an error with a payload that has no
   * collection at all. `filter` in the controlled-term component already tests
   * for it and reports what came back instead, so the declaration now says what
   * that branch has always known.
   */
  collection?: IntegratedSearchResponseItem[];
}
