/**
 * One term from the terminology server's integrated search.
 *
 * An interface rather than a class, for the reason given on
 * `IntegratedSearchResponse`: these are cast from JSON, never built.
 */
export interface IntegratedSearchResponseItem {
  /**
   * The term's IRI under its JSON-LD key, which is what CEE reads when a term is
   * chosen. It was absent from this type while `onSelectionChange` indexed the item
   * by `JsonSchema.atId` — the read was right and the declaration was short. The
   * visual suite's stub of this endpoint sends both keys, which is the evidence the
   * service really does return `@id` alongside `id`.
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
