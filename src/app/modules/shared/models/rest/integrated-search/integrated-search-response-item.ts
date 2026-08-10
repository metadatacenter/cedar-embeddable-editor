/**
 * One term as the terminology server's integrated search sends it.
 *
 * The wire document, not CEE's model of a term: `ControlledFieldDataService`
 * converts these to `AuthorityTerm` on arrival and nothing downstream sees this
 * shape. An interface rather than a class, for the reason given on
 * `IntegratedSearchResponse` — these are cast from JSON, never built.
 */
export interface IntegratedSearchResponseItem {
  /**
   * The term's IRI, and the only property CEE takes from a result besides its
   * label.
   *
   * One of the two places CEE names a JSON-LD key on purpose, and it names it as
   * the wire format it is rather than through the model library's constants: the
   * terminology server chose this spelling, and CEDAR's own serialization has no
   * say in it. `id` alongside is not the same value — the server sends a short
   * identifier there for a term reached through a value constraint, and the full
   * URI here.
   */
  '@id': string;
  id: string;
  type: string;
  /**
   * Optional for the same reason as `collection`: the search component tests each
   * item for a label and drops the ones without, so an item arriving without one
   * is a state the code already handles rather than one it assumes away.
   */
  prefLabel?: string;
  notation: object;
  definition: string;
  source: string;
}
