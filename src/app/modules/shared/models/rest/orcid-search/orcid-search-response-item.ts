import { ResearcherDetails } from '../orcid-detail/orcid-detail-person';
import { JsonSchema } from 'cedar-model-typescript-library';

/*
 * Why the `@id` and `rdfs:label` reads are cast at their call sites.
 *
 * The model library declares its key constants as `static atId: string`, not as a
 * literal, so `[JsonSchema.atId]: string` here is an index signature over every
 * string key rather than one named property. Any other property then has to be
 * assignable to it, and reading through the constant yields the union of all of
 * them — `string | ResearcherDetails` — which is what TypeScript 5.8 began
 * enforcing. Earlier versions accepted the computed key only under a
 * `@ts-expect-error`, which 5.8 then reported as unused; both are gone.
 *
 * A literal `readonly atId = '@id'` in the library would fix this properly and
 * remove every cast. Until then the reads assert what the two keys have always
 * held, which is a string.
 */
export interface OrcidSearchResponseItem {
  [JsonSchema.atId]: string;
  [JsonSchema.rdfsLabel]: string;
  _details?: string;
  researcherDetails?: ResearcherDetails;
}
