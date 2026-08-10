import { AuthorityTerm } from './authority-search-response.model';
import { RorDetailResponse } from '../rest/ror-detail/ror-detail-response';

/**
 * A term from ROR, carrying the organisation record its widget shows.
 *
 * An extension rather than a copy of the two properties — see `OrcidTerm` for
 * why that was not possible while the properties were serialization keys.
 */
export interface RorTerm extends AuthorityTerm {
  details?: RorDetailResponse;
}
