import { ResearcherDetails } from '../orcid-detail/orcid-detail-person';

export interface OrcidSearchResponseItem {
  id: string;
  rdfsLabel: string;
  researcherDetails?: ResearcherDetails;
}
