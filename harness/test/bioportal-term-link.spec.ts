/**
 * The link a controlled field offers out to BioPortal.
 *
 * It was built from `bioPortalPrefix`, a configuration key named as a prefix and
 * used as a link base — and only for class and ontology constraints. A branch was
 * linked through its own `source`, which is not a URL: across the corpus a branch
 * carries `"Medical Subject Headings (MESH)"`, or the FDC-GDMT ontology's full
 * name, or occasionally a bioportal.bioontology.org URL. Two of those three
 * produced a relative link resolved against whatever page CEE was embedded in.
 *
 * Nothing covered it, which is why the shapes below are taken from real corpus
 * templates rather than invented.
 */
import { describe, expect, it } from 'vitest';
import { bioPortalTermLink } from '@cee/util/bioportal-term-link';
import { ControlledInfo } from '@cee/models/info/controlled-info.model';

const controlled = (over: Partial<ControlledInfo>): ControlledInfo => Object.assign(new ControlledInfo(), over);

const TERM = 'http://purl.bioontology.org/ontology/MESH/D055641';

describe('the BioPortal link', () => {
  it('names the ontology by acronym when a branch carries a display name', () => {
    // template-023: source is "Medical Subject Headings (MESH)", which is not a URL.
    const link = bioPortalTermLink(
      controlled({ branches: [{ source: 'Medical Subject Headings (MESH)', acronym: 'MESH', uri: TERM }] }),
      TERM,
    );

    expect(link).toBe(
      'https://bioportal.bioontology.org/ontologies/MESH?p=classes&conceptid=' + encodeURIComponent(TERM),
    );
    expect(link, 'a display name must not reach the URL').not.toContain('Medical Subject');
  });

  it('gives the same link when the branch happens to carry a URL', () => {
    // template-029: source is a bioportal URL. The acronym says the same thing.
    const link = bioPortalTermLink(
      controlled({
        branches: [{ source: 'https://bioportal.bioontology.org/ontologies/FDC-GDMT', acronym: 'FDC-GDMT' }],
      }),
      TERM,
    );

    expect(link).toBe(
      'https://bioportal.bioontology.org/ontologies/FDC-GDMT?p=classes&conceptid=' + encodeURIComponent(TERM),
    );
  });

  it('reads a class constraint, whose acronym lives in source', () => {
    const link = bioPortalTermLink(controlled({ classes: [{ source: 'MESH', uri: TERM }] }), TERM);
    expect(link).toContain('/ontologies/MESH?');
  });

  it('reads an ontology constraint', () => {
    const link = bioPortalTermLink(controlled({ ontologies: [{ acronym: 'DOID' }] }), TERM);
    expect(link).toContain('/ontologies/DOID?');
  });

  it('prefers the branch when a field is constrained more than one way', () => {
    const link = bioPortalTermLink(
      controlled({ branches: [{ acronym: 'MESH' }], ontologies: [{ acronym: 'DOID' }] }),
      TERM,
    );
    expect(link).toContain('/ontologies/MESH?');
  });

  it('is null with no term selected, and with no constraint to name one', () => {
    expect(bioPortalTermLink(controlled({ branches: [{ acronym: 'MESH' }] }), null)).toBeNull();
    expect(bioPortalTermLink(controlled({}), TERM)).toBeNull();
    expect(bioPortalTermLink(controlled({ ontologies: [{}] }), TERM)).toBeNull();
  });

  it('escapes an acronym rather than letting it shape the URL', () => {
    const link = bioPortalTermLink(controlled({ ontologies: [{ acronym: 'A/B?x=1' }] }), TERM);
    expect(link).toContain('/ontologies/A%2FB%3Fx%3D1?');
  });
});
