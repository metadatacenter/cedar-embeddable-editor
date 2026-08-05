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

  /**
   * The control error key this authority's template listens for —
   * `invalidOrcid`, `invalidRrid`, and so on.
   *
   * Per-type rather than shared because each widget renders its own
   * `mat-error` with its own message, and those messages name the authority.
   */
  readonly errorKey: string;

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
   * The host page's config keys for this authority's two endpoints, and the
   * paths used when the config names neither.
   *
   * Here because the editor component had fourteen identical blocks — read the
   * key, fall back to a default, prepend the base URL, hand it to that
   * authority's own service — one per authority per endpoint. An eighth
   * authority meant two more blocks and a new service to hand them to.
   */
  readonly searchUrlConfigKey: string;
  readonly detailsUrlConfigKey: string;
  readonly defaultSearchPath: string;
  readonly defaultDetailsPath: string;
}

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
    searchUrlConfigKey: 'orcidIntegratedExtAuthUrl',
    detailsUrlConfigKey: 'orcidIntegratedDetailsUrl',
    defaultSearchPath: 'orcid/search-by-name',
    defaultDetailsPath: 'orcid',
    label: 'ORCID',
    errorKey: 'invalidOrcid',
    placeholderKey: 'Generic.FilterOrcid',
    invalidMessageKey: 'Validation.OrcidInvalid',
    revertedMessageKey: 'Validation.OrcidReverted',
    looksLikeIdentifier: byPattern(/^(http|0|orcid\.org)/i),
  },
  {
    inputType: InputType.ror,
    searchUrlConfigKey: 'rorIntegratedExtAuthUrl',
    detailsUrlConfigKey: 'rorIntegratedDetailsUrl',
    defaultSearchPath: 'ror/search-by-name',
    defaultDetailsPath: 'ror',
    label: 'ROR',
    errorKey: 'invalidRor',
    placeholderKey: 'Generic.FilterRor',
    invalidMessageKey: 'Validation.RorInvalid',
    revertedMessageKey: 'Validation.RorReverted',
    looksLikeIdentifier: byPattern(/^(http|0|ror\.org)/i),
  },
  {
    inputType: InputType.pfas,
    searchUrlConfigKey: 'pfasIntegratedExtAuthUrl',
    detailsUrlConfigKey: 'pfasIntegratedDetailsUrl',
    defaultSearchPath: 'comp-tox/search-by-name',
    defaultDetailsPath: 'comp-tox',
    label: 'PFAS',
    errorKey: 'invalidPfas',
    placeholderKey: 'Generic.FilterPfas',
    invalidMessageKey: 'Validation.PfasInvalid',
    revertedMessageKey: 'Validation.PfasReverted',
    looksLikeIdentifier: byPattern(/^(https?:\/\/|http:\/\/|DTXSID|comptox\.epa\.gov)/i),
  },
  {
    inputType: InputType.pmid,
    searchUrlConfigKey: 'pmidIntegratedExtAuthUrl',
    detailsUrlConfigKey: 'pmidIntegratedDetailsUrl',
    defaultSearchPath: 'pmid/search-by-name',
    defaultDetailsPath: 'pmid',
    label: 'PubMed',
    errorKey: 'invalidPmid',
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
    searchUrlConfigKey: 'rridIntegratedExtAuthUrl',
    detailsUrlConfigKey: 'rridIntegratedDetailsUrl',
    defaultSearchPath: 'rrid/search-by-name',
    defaultDetailsPath: 'rrid',
    label: 'RRID',
    errorKey: 'invalidRrid',
    placeholderKey: 'Generic.FilterRrid',
    invalidMessageKey: 'Validation.RridInvalid',
    revertedMessageKey: 'Validation.RridReverted',
    looksLikeIdentifier: byPattern(/^(?:(?:https?:\/\/)?identifiers\.org\/RRID:\d+\b|RRID:\d+\b|\d+\b)/i),
  },
  {
    inputType: InputType.nihGrant,
    searchUrlConfigKey: 'nihGrantIntegratedExtAuthUrl',
    detailsUrlConfigKey: 'nihGrantIntegratedDetailsUrl',
    defaultSearchPath: 'nih-grant/search-by-name',
    defaultDetailsPath: 'nih-grant',
    label: 'NIH Grant',
    errorKey: 'invalidNihGrant',
    placeholderKey: 'Generic.FilterNihGrant',
    invalidMessageKey: 'Validation.NihGrantInvalid',
    revertedMessageKey: 'Validation.NihGrantReverted',
    // The widget tests its pattern *or* a leading digit, at the call site. Both
    // halves belong to the same question, so both are here.
    looksLikeIdentifier: byPattern(/^(https?:\/\/|http:\/\/|[0-9])/i),
  },
  {
    inputType: InputType.doi,
    searchUrlConfigKey: 'doiIntegratedExtAuthUrl',
    detailsUrlConfigKey: 'doiIntegratedDetailsUrl',
    defaultSearchPath: 'doi/search-by-name',
    defaultDetailsPath: 'doi',
    label: 'DOI',
    errorKey: 'invalidDoi',
    placeholderKey: 'Generic.FilterDoi',
    invalidMessageKey: 'Validation.DoiInvalid',
    revertedMessageKey: 'Validation.DoiReverted',
    looksLikeIdentifier: byPattern(/^(https?:\/\/|http:\/\/|doi:|10\.)/i),
  },
];

/** The descriptor for an input type, or null when the type is not an authority. */
export const authorityDescriptorFor = (inputType: InputType): AuthorityDescriptor | null =>
  AUTHORITY_DESCRIPTORS.find((d) => d.inputType === inputType) ?? null;
