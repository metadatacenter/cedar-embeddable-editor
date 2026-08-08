export class IntegratedSearchResponseItem {
  /**
   * The term's IRI under its JSON-LD key, which is what CEE reads when a term is
   * chosen. It was absent from this class while `onSelectionChange` indexed the item
   * by `JsonSchema.atId` — the read was right and the declaration was short. The
   * visual suite's stub of this endpoint sends both keys, which is the evidence the
   * service really does return `@id` alongside `id`.
   */
  '@id': string;
  id: string;
  type: string;
  prefLabel: string;
  notation: object;
  definition: string;
  source: string;
}
