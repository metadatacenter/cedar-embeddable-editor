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
  /** ORCID's search results carry a details URL alongside the term. */
  _details?: string;
}

/*
 * Why there is no `details` here.
 *
 * There were two members, `details?: any` and `researcherDetails?: any`, and
 * nothing read either through this type: ORCID and ROR render their panels from
 * `OrcidSearchResponseItem.researcherDetails` and `RorSearchResponseItem.details`,
 * which are typed, and the five simple authorities never look at a record at all.
 * The base `filter` wrote `details` and no one collected it.
 *
 * They could not be typed where they stood, either. `JsonSchema.atId` is declared
 * `static atId: string` rather than as a literal, so `[JsonSchema.atId]: string`
 * above is an index signature over every string key instead of one named property
 * — see the note in `orcid-search-response-item.ts`. Every other member joins that
 * signature's type, and the two subtypes above stay interchangeable with this one
 * only while it stays `string`. `any` was what let an object sit under a signature
 * that says `string`; a real type here breaks the two subtypes instead. Literal key
 * constants in the model library remove the whole problem.
 */

export interface AuthoritySearchResponse {
  /**
   * Optional, because it is whatever the authority said. A response that omits
   * it is treated as a hit — every consumer tests `found === false` rather than
   * falsiness, which is what lets a terse endpoint answer with results alone.
   */
  found: boolean | undefined;
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
