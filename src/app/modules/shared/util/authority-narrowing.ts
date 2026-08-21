import { AuthorityTerm } from '../models/authority/authority-search-response.model';

/**
 * Keep the results whose label answers what was typed, without discarding the
 * ones the authority found.
 *
 * The narrowing exists because the seven endpoints are inconsistent about
 * honouring `q`: some answer a name search with everything they hold, and a field
 * offering that is worse than one offering nothing. It was written as a substring
 * test on the whole query, which is the obvious reading and the wrong one — a
 * person searched for as they are named is very often recorded with a middle
 * initial, so "Mark Musen" does not occur in "Mark A. Musen" and the one correct
 * ORCID was thrown away *after* the server had found it. The field then said "No
 * results found", which is true of the list and false of the search.
 *
 * Every word instead, in any order. "Mark Musen" keeps "Mark A. Musen"; "Musen
 * Mark" keeps it too; "Marcus" keeps nothing, which is the case the narrowing is
 * for.
 */
export function narrowByQuery(results: readonly AuthorityTerm[], query: string): AuthorityTerm[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...results];
  }
  return results.filter((option) => {
    const label = (option?.label ?? '').toLowerCase();
    return words.every((word) => label.includes(word));
  });
}
