/**
 * The descriptors, against the seven widgets they replace.
 *
 * Unifying the external authority fields means moving each type's differences
 * into a descriptor. The only *behavioural* difference between the widgets is
 * the pattern that decides whether typed text is an identifier to resolve or a
 * name to search — so that pattern is the thing a unification can silently get
 * wrong, and the thing to pin before anything depends on it.
 *
 * Each pattern below is transcribed from the widget it came from, and the cases
 * are chosen to catch a transcription slip rather than to describe what the
 * pattern *should* be. Where a pattern is wrong, it is recorded as wrong.
 */
import { describe, expect, it } from 'vitest';
import {
  AUTHORITY_DESCRIPTORS,
  authorityDescriptorFor,
} from '@cee/models/authority/authority-descriptor.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '@cee/models/ext-auth-categories.model';
import { InputType } from '@cee/models/input-type.model';

describe('there is exactly one descriptor per authority type', () => {
  /**
   * `EXTERNAL_AUTHORITY_INPUT_TYPES` is the canonical list of the seven, and it
   * is already what `valueIsIri` and the empty-slot rule consult. The descriptors
   * have to cover exactly it — a type with no descriptor would render with no
   * search, and a descriptor with no type would be dead.
   */
  it('covers the canonical set and nothing else', () => {
    const described = AUTHORITY_DESCRIPTORS.map((d) => d.inputType).sort();
    expect(described).toEqual([...EXTERNAL_AUTHORITY_INPUT_TYPES].sort());
  });

  it('has no duplicates', () => {
    const types = AUTHORITY_DESCRIPTORS.map((d) => d.inputType);
    expect(new Set(types).size).toBe(types.length);
  });

  it('gives every one a distinct error key', () => {
    const keys = AUTHORITY_DESCRIPTORS.map((d) => d.errorKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('returns null for a type that is not an authority', () => {
    expect(authorityDescriptorFor(InputType.textfield)).toBeNull();
    expect(authorityDescriptorFor(InputType.link)).toBeNull();
  });
});

/**
 * Each pattern, as the widget had it.
 *
 * `accepts` and `rejects` are transcription checks. They are not a specification
 * of what each authority's identifiers look like — several of these patterns are
 * looser than that, and one is simply another authority's.
 */
const CASES: Array<{
  type: InputType;
  source: string;
  accepts: string[];
  rejects: string[];
}> = [
  {
    type: InputType.orcid,
    source: 'cedar-input-orcid.component.ts, /^(http|0|orcid\\.org)/i',
    accepts: ['https://orcid.org/0000-0002-1825-0097', '0000-0002-1825-0097', 'orcid.org/0000-0002-1825-0097'],
    rejects: ['Jane Doe', 'doi:10.1000/x'],
  },
  {
    type: InputType.ror,
    source: 'cedar-input-ror.component.ts, /^(http|0|ror\\.org)/i',
    accepts: ['https://ror.org/00f54p054', '00f54p054', 'ror.org/00f54p054'],
    rejects: ['Stanford University', 'DTXSID101'],
  },
  {
    type: InputType.pfas,
    source: 'cedar-input-pfas.component.ts',
    accepts: ['DTXSID1234567', 'comptox.epa.gov/x', 'https://comptox.epa.gov/x'],
    rejects: ['perfluorooctanoic acid', '10.1000/x'],
  },
  {
    type: InputType.rrid,
    source: 'cedar-input-rrid.component.ts',
    accepts: ['RRID:12345', 'identifiers.org/RRID:12345', 'https://identifiers.org/RRID:12345', '12345'],
    rejects: ['anti-GFP antibody', 'DTXSID1234567'],
  },
  {
    type: InputType.nihGrant,
    source: 'cedar-input-nih-grant.component.ts, pattern OR a leading digit at the call site',
    accepts: ['https://reporter.nih.gov/x', '5R01GM123456', '1'],
    rejects: ['cancer immunotherapy', 'R01GM123456'],
  },
  {
    type: InputType.doi,
    source: 'cedar-input-doi.component.ts',
    accepts: ['https://doi.org/10.1000/x', 'doi:10.1000/x', '10.1000/x'],
    rejects: ['A paper about things', 'DTXSID1234567'],
  },
];

describe('each pattern matches the widget it came from', () => {
  for (const { type, source, accepts, rejects } of CASES) {
    const descriptor = authorityDescriptorFor(type)!;

    it.each(accepts)(`${type} (${source}) accepts %s`, (text) => {
      expect(descriptor.looksLikeIdentifier(text)).toBe(true);
    });

    it.each(rejects)(`${type} accepts nothing it should not: %s`, (text) => {
      expect(descriptor.looksLikeIdentifier(text)).toBe(false);
    });
  }

  it('treats surrounding whitespace as insignificant, as every widget did', () => {
    expect(authorityDescriptorFor(InputType.rrid)!.looksLikeIdentifier('  RRID:12345  ')).toBe(true);
  });

  it('survives null and undefined', () => {
    for (const descriptor of AUTHORITY_DESCRIPTORS) {
      expect(descriptor.looksLikeIdentifier(null as never)).toBe(false);
      expect(descriptor.looksLikeIdentifier(undefined as never)).toBe(false);
    }
  });
});

describe('PubMed carries PFAS’s pattern', () => {
  /**
   * KNOWN DEFECT, transcribed rather than fixed, so that the unification is
   * provably behaviour-preserving and the fix is a change of its own.
   *
   * The PubMed widget was produced from the PFAS one and this line was never
   * changed. A PubMed field therefore treats `DTXSID…` as an identifier to
   * resolve, and treats a PubMed ID as a name to search for. It is the clearest
   * single illustration of what seven copies cost: the bug is invisible unless
   * you diff two files nobody had reason to diff.
   */
  const pmid = authorityDescriptorFor(InputType.pmid)!;
  const pfas = authorityDescriptorFor(InputType.pfas)!;

  it.each(['DTXSID1234567', 'comptox.epa.gov/x'])('accepts %s, which is not a PubMed identifier', (text) => {
    expect(pmid.looksLikeIdentifier(text)).toBe(true);
  });

  it.each(['12345678', 'PMID:12345678', 'pubmed.ncbi.nlm.nih.gov/12345678'])(
    'rejects %s, which is one',
    (text) => {
      expect(pmid.looksLikeIdentifier(text)).toBe(false);
    },
  );

  it('agrees with PFAS on every case, which is the giveaway', () => {
    for (const text of ['DTXSID1', 'comptox.epa.gov', '12345678', 'https://x', 'a name']) {
      expect(pmid.looksLikeIdentifier(text)).toBe(pfas.looksLikeIdentifier(text));
    }
  });
});
