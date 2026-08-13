import { AuthorityTerm } from './authority-search-response.model';

/**
 * Whether a field's declared default names a term.
 *
 * `ValueInfo.defaultValue` holds whatever kind of default the field declares: a
 * string for a text field, a boolean for a checkbox, a term for a controlled or
 * authority field. The three widgets that want a term have to establish that
 * they got one, and this is the test — a guard rather than a cast, so a template
 * declaring a bare string where a term belongs falls through instead of reaching
 * the field as a term with two undefined halves.
 */
export const isAuthorityTerm = (value: unknown): value is AuthorityTerm =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AuthorityTerm).iri === 'string' &&
  typeof (value as AuthorityTerm).label === 'string';
