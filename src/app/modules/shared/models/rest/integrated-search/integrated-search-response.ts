import { IntegratedSearchResponseItem } from './integrated-search-response-item';

/**
 * What the terminology server's integrated search answers with.
 *
 * An interface rather than a class: nothing constructs one. It exists as the type
 * argument to `http.post`, describing JSON that arrives — and a class there
 * carries an initialisation obligation for fields no constructor will ever set.
 */
export interface IntegratedSearchResponse {
  totalCount: number;
  /** The limit and offset the page was served at. */
  request: { limit: number; offset: number };
  currentOffset: number;
  /** Present, and true, when `totalCount` is the number a capped window reached rather than the whole. */
  countCapped?: boolean;
  /**
   * Optional, because the endpoint answers an error with a payload that has no
   * collection at all. `filter` in the controlled-term component already tests
   * for it and reports what came back instead, so the declaration now says what
   * that branch has always known.
   */
  collection?: IntegratedSearchResponseItem[];
}
