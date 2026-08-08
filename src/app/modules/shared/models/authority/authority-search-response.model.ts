import { JsonSchema } from 'cedar-model-typescript-library';

/**
 * One result from an authority lookup: an IRI and a label.
 *
 * Replaces seven `*SearchResponseItem` interfaces that declared exactly these
 * two keys, and five `*DetailResponse` classes that were byte-identical but for
 * their own name. The two rich detail models — ORCID's researcher record and
 * ROR's organisation record — are genuinely different documents and keep their
 * own types; `details` carries whichever of those applies.
 */
export interface AuthoritySearchResponseItem {
  [JsonSchema.atId]: string;
  [JsonSchema.rdfsLabel]: string;
  /**
   * The authority's own record for this term, when the widget shows one.
   *
   * Deliberately untyped here. ORCID and ROR each render a panel from a document
   * with its own shape, and those two components know what they asked for; the
   * five simple authorities never look at it.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
  /** ORCID's search results carry a details URL alongside the term. */
  _details?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  researcherDetails?: any;
}

export interface AuthoritySearchResponse {
  found: boolean;
  results: Array<AuthoritySearchResponseItem>;
}

/**
 * What resolving a single identifier returns.
 *
 * Five authorities had a class each for this, identical down to the
 * `fromJSON` — `{found, name, id, requestedId}`. One interface serves them, and
 * `fromJSON` is unnecessary because nothing about the response needed
 * constructing: every use read the three fields straight off it.
 */
export interface AuthorityDetailResponse {
  found: boolean;
  name: string;
  id: string;
  requestedId?: string;
}
