import { AuthorityTerm } from './authority-search-response.model';
import { ResearcherDetails } from '../rest/orcid-detail/orcid-detail-person';

/**
 * A term from ORCID, carrying the researcher record its widget shows.
 *
 * An extension rather than a copy of the two properties, which is what this was
 * while `AuthorityTerm` declared them through key constants: a computed key
 * whose type is not a literal is an index signature, so `researcherDetails` had
 * to be assignable to it and every read of a term came back
 * `string | ResearcherDetails`.
 */
export interface OrcidTerm extends AuthorityTerm {
  researcherDetails?: ResearcherDetails;
}
