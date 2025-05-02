import { ResearcherDetails } from '../orcid-detail/orcid-detail-person';
import { JsonSchema } from '../../json-schema.model';

export interface OrcidSearchResponseItem {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  [JsonSchema.atId]: string;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  [JsonSchema.rdfsLabel]: string;
  _details?: string;
  researcherDetails?: ResearcherDetails;
}
