/**
 * One term from an authority lookup: an IRI and the label it is shown by.
 *
 * Replaces seven `*SearchResponseItem` interfaces that declared exactly these
 * two things, and five `*DetailResponse` classes that were byte-identical but
 * for their own name. The two rich detail models — ORCID's researcher record and
 * ROR's organisation record — are genuinely different documents and keep their
 * own types, carried by `OrcidTerm` and `RorTerm`.
 *
 * The properties were `@id` and `rdfs:label` until CEE stopped speaking CEDAR's
 * serialization anywhere but at its edges. Nothing about a term from ORCID or
 * ROR is JSON-LD: the authority answers with `results[iri].name`, the value
 * reaches the instance through `changeControlledValue`, and the model library
 * decides how an IRI and a label are written down. Borrowing the two key
 * constants for CEE's own model of a term put that decision in fifteen files.
 *
 * Naming the properties also makes them properties. `JsonSchema.atId` is
 * declared `static atId: string` rather than as a literal, so `[JsonSchema.atId]:
 * string` was an index signature over every string key — which is why `details`
 * could not be typed here, why every read needed `as string`, and why the two
 * enriched terms below could only widen the signature rather than extend it.
 */
export interface AuthorityTerm {
  iri: string;
  label: string;
  /** ORCID's search results carry a details URL alongside the term. */
  detailsUrl?: string;
}

export interface AuthoritySearchResponse {
  /**
   * Optional, because it is whatever the authority said. A response that omits
   * it is treated as a hit — every consumer tests `found === false` rather than
   * falsiness, which is what lets a terse endpoint answer with results alone.
   */
  found: boolean | undefined;
  results: Array<AuthorityTerm>;
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
