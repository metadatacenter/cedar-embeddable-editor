import { ResearcherDetails } from '../orcid-detail/orcid-detail-person';

export interface OrcidSearchResponseItem {
  id: string;
  rdfsLabel: string;
  _details?: string;
  researcherDetails?: ResearcherDetails;
}
