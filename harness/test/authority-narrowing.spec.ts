/**
 * What a name search is allowed to throw away.
 *
 * The narrowing guards against endpoints that ignore `q` and answer with
 * everything. Written as a substring test on the whole query, it also threw away
 * the answer: an ORCID search for "Mark Musen" reaches a record labelled "Mark A.
 * Musen", the substring is absent, and the one correct result was discarded after
 * the server had found it — a field reporting "No results found" for a search that
 * succeeded. Nothing caught it, because the browser suite points the authority
 * endpoints at a discard port and never sees a real record.
 */
import { describe, expect, it } from 'vitest';
import { narrowByQuery } from '@cee/util/authority-narrowing';
import { AuthorityTerm } from '@cee/models/authority/authority-search-response.model';

const term = (label: string): AuthorityTerm => ({ iri: `https://example.org/${label}`, label });

describe('narrowing an authority search by what was typed', () => {
  /** The case that was broken, with the real strings it was broken on. */
  it('keeps a record whose label carries a middle initial', () => {
    const results = [term('Mark A. Musen'), term('Kate Musen')];
    expect(narrowByQuery(results, 'Mark Musen').map((t) => t.label)).toEqual(['Mark A. Musen']);
  });

  it('does not care what order the words were typed in', () => {
    const results = [term('Mark A. Musen')];
    expect(narrowByQuery(results, 'Musen Mark')).toHaveLength(1);
  });

  /** Still narrowing: this is what the guard is for. */
  it('drops a record that answers only some of the words', () => {
    const results = [term('Mark A. Musen'), term('Marcus Aurelius')];
    expect(narrowByQuery(results, 'Marcus Musen')).toEqual([]);
  });

  it('drops a record matching nothing typed', () => {
    expect(narrowByQuery([term('Mark A. Musen')], 'Nightingale')).toEqual([]);
  });

  it('is indifferent to case', () => {
    expect(narrowByQuery([term('Mark A. Musen')], 'mARK musen')).toHaveLength(1);
  });

  /**
   * An empty query reaches here from the control's `startWith('')`, and every
   * result is still every result.
   */
  it.each([[''], ['   ']])('keeps everything for a blank query: %j', (query) => {
    const results = [term('Mark A. Musen'), term('Kate Musen')];
    expect(narrowByQuery(results, query)).toHaveLength(2);
  });

  it('keeps a label matching the whole query exactly', () => {
    expect(narrowByQuery([term('Stanford University')], 'Stanford University')).toHaveLength(1);
  });

  it('answers an empty result set with an empty one', () => {
    expect(narrowByQuery([], 'anything')).toEqual([]);
  });
});
