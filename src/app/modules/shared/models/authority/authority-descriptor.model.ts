import { InputType } from '../input-type.model';

/**
 * Everything that distinguishes one external authority from another.
 *
 * ORCID, ROR, PFAS, PubMed, RRID, NIH Grant and DOI were implemented seven
 * times over — seven lookup services, seven response-model pairs, seven
 * components — and the implementations were near-identical by construction: the
 * later ones were produced from the ROR pair by name substitution. Comparing the
 * five simplest widgets line by line, the only *behavioural* difference between
 * any two of them is the pattern below that recognises an identifier. Everything
 * else was a class name, a URL field name, or dead commented-out code.
 *
 * That mattered practically, not just aesthetically. A validator pointed at the
 * wrong thing shipped an error on every keystroke of all seven at once, and the
 * blur handling that should have discarded unusable free text existed in one of
 * the seven, was present-but-unwired in a second, and was absent from the other
 * five. Seven copies is seven chances for the same rule to be right in one place
 * and wrong in six.
 *
 * A descriptor per authority, and one implementation of the flow.
 */
export interface AuthorityDescriptor {
  /** The `_ui.inputType` this descriptor serves. The registry key. */
  readonly inputType: InputType;

  /** Human name, used in messages. "ORCID", "NIH Grant". */
  readonly label: string;

  /** Translation keys for the field's own messages. */
  readonly placeholderKey: string;
  readonly invalidMessageKey: string;
  readonly revertedMessageKey: string;

  /**
   * True when the text typed looks like an identifier rather than a name.
   *
   * The one thing that genuinely differs between authorities: `DTXSID…` for
   * PFAS, `RRID:1234` for RRID, a bare number for PubMed. When it matches, the
   * widget resolves the identifier directly instead of running a name search.
   */
  looksLikeIdentifier(text: string): boolean;

  /**
   * This authority's two endpoints under `EXTERNAL_AUTHORITY_PATH`: the search
   * path, and the path an identifier is resolved through.
   *
   * Here because the editor component had fourteen identical blocks — read the
   * key, fall back to a default, prepend the base URL, hand it to that
   * authority's own service — one per authority per endpoint. An eighth
   * authority meant two more blocks and a new service to hand them to.
   *
   * Neither is configurable. Both were, through fourteen host keys, and every
   * host that set one set the value below — CEE's own default, restated. The
   * paths are the bridge server's, and `bridgeBaseUrl` identifies that server, so
   * a host free to move them could only move them somewhere nothing answers.
   */
  readonly searchPath: string;
  readonly detailsPath: string;
}

/**
 * The bridge server's external-authority resource, under whatever base a host
 * names.
 *
 * CEE's, like the paths below it. It reached CEE inside the host's own key for as
 * long as that key was `extAuthBaseUrl` and had to be given as
 * `https://bridge.<domain>/ext-auth/` — one segment of the bridge server's own
 * route shape, spelled out in every deployment config, which is what
 * `bioportal/integrated-search` was on the terminology side.
 */
export const EXTERNAL_AUTHORITY_PATH = 'ext-auth/';

/**
 * Recognise an identifier by pattern, which is how all seven do it.
 *
 * Kept as a helper so each descriptor states its pattern and nothing else, and
 * so the trimming and case-insensitivity are decided once rather than seven
 * times.
 */
const byPattern =
  (pattern: RegExp) =>
  (text: string): boolean =>
    pattern.test((text ?? '').trim());

/**
 * The seven authorities CEE knows.
 *
 * Patterns are transcribed verbatim from the widgets they came from — this is a
 * refactor, and a "tidied" regex here would be a silent behaviour change to a
 * field's search. `authority-descriptors.spec.ts` pins each one against the
 * examples it has to accept and reject.
 */
export const AUTHORITY_DESCRIPTORS: ReadonlyArray<AuthorityDescriptor> = [
  {
    inputType: InputType.orcid,
    searchPath: 'orcid/search-by-name',
    detailsPath: 'orcid',
    label: 'ORCID',
    placeholderKey: 'Generic.FilterOrcid',
    invalidMessageKey: 'Validation.OrcidInvalid',
    revertedMessageKey: 'Validation.OrcidReverted',
    looksLikeIdentifier: byPattern(/^(http|0|orcid\.org)/i),
  },
  {
    inputType: InputType.ror,
    searchPath: 'ror/search-by-name',
    detailsPath: 'ror',
    label: 'ROR',
    placeholderKey: 'Generic.FilterRor',
    invalidMessageKey: 'Validation.RorInvalid',
    revertedMessageKey: 'Validation.RorReverted',
    looksLikeIdentifier: byPattern(/^(http|0|ror\.org)/i),
  },
  {
    inputType: InputType.pfas,
    searchPath: 'comp-tox/search-by-name',
    detailsPath: 'comp-tox',
    label: 'PFAS',
    placeholderKey: 'Generic.FilterPfas',
    invalidMessageKey: 'Validation.PfasInvalid',
    revertedMessageKey: 'Validation.PfasReverted',
    looksLikeIdentifier: byPattern(/^(https?:\/\/|http:\/\/|DTXSID|comptox\.epa\.gov)/i),
  },
  {
    inputType: InputType.pmid,
    searchPath: 'pmid/search-by-name',
    detailsPath: 'pmid',
    label: 'PubMed',
    placeholderKey: 'Generic.FilterPmid',
    invalidMessageKey: 'Validation.PmidInvalid',
    revertedMessageKey: 'Validation.PmidReverted',
    // Was PFAS's pattern, verbatim: the PubMed widget was produced from the PFAS
    // one and this line was never changed, so a PubMed field treated `DTXSID…`
    // as an identifier to resolve and a PubMed ID as a name to search for.
    // Invisible unless you diff two files nobody had reason to diff, which is
    // what seven copies cost.
    //
    // A PubMed ID is a bare number; the site and the `PMID:` prefix are the two
    // other ways it is written down. Kept narrow deliberately — this decides
    // whether to resolve an identifier or run a name search, and anything looser
    // would send ordinary search text to the resolve endpoint.
    looksLikeIdentifier: byPattern(
      /^(?:https?:\/\/(?:www\.)?ncbi\.nlm\.nih\.gov\/pubmed\/\d+|https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/?|PMID:\s*\d+|\d+)$/i,
    ),
  },
  {
    inputType: InputType.rrid,
    searchPath: 'rrid/search-by-name',
    detailsPath: 'rrid',
    label: 'RRID',
    placeholderKey: 'Generic.FilterRrid',
    invalidMessageKey: 'Validation.RridInvalid',
    revertedMessageKey: 'Validation.RridReverted',
    looksLikeIdentifier: byPattern(/^(?:(?:https?:\/\/)?identifiers\.org\/RRID:\d+\b|RRID:\d+\b|\d+\b)/i),
  },
  {
    inputType: InputType.nihGrant,
    searchPath: 'nih-grant/search-by-name',
    detailsPath: 'nih-grant',
    label: 'NIH Grant',
    placeholderKey: 'Generic.FilterNihGrant',
    invalidMessageKey: 'Validation.NihGrantInvalid',
    revertedMessageKey: 'Validation.NihGrantReverted',
    // The widget tests its pattern *or* a leading digit, at the call site. Both
    // halves belong to the same question, so both are here.
    looksLikeIdentifier: byPattern(/^(https?:\/\/|http:\/\/|[0-9])/i),
  },
  {
    inputType: InputType.doi,
    searchPath: 'doi/search-by-name',
    detailsPath: 'doi',
    label: 'DOI',
    placeholderKey: 'Generic.FilterDoi',
    invalidMessageKey: 'Validation.DoiInvalid',
    revertedMessageKey: 'Validation.DoiReverted',
    looksLikeIdentifier: byPattern(/^(https?:\/\/|http:\/\/|doi:|10\.)/i),
  },
];

/** The descriptor for an input type, or null when the type is not an authority. */
export const authorityDescriptorFor = (inputType: InputType): AuthorityDescriptor | null =>
  AUTHORITY_DESCRIPTORS.find((d) => d.inputType === inputType) ?? null;
