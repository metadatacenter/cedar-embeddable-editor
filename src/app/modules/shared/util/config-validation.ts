import { AUTHORITY_DESCRIPTORS } from '../models/authority/authority-descriptor.model';

/**
 * What CEE will say about a configuration a host handed it.
 *
 * The declarations the package ships describe this surface, and a TypeScript host
 * gets a compile error for a misspelled key or a wrong value. A JavaScript host
 * has no such protection, and used to be answered with silence — an unknown key is
 * simply never read, which looks exactly like a key that works.
 *
 * Reporting only. Nothing here rejects a configuration or changes what CEE does
 * with it: a key that fails this check is ignored by the reader downstream, as it
 * always was, and the host is now told so. Rejecting a whole configuration over
 * one bad key would take an editor a host had configured acceptably and leave it
 * with none, and configuration is applied once, so there is nothing to fall back
 * to.
 */

/** What a key's value has to be. */
type ExpectedType = 'boolean' | 'string' | 'serialization';

/**
 * Every key CEE reads, and what it expects.
 *
 * The runtime counterpart to `CeeConfig`, which is an interface and so exists only
 * at compile time. `cee-public-api.spec.ts` holds the two together, along with the
 * component's own key constants, so the three cannot drift.
 */
export const CONFIG_SCHEMA: Readonly<Record<string, ExpectedType>> = {
  showHeader: 'boolean',
  showFooter: 'boolean',
  showTemplateDescription: 'boolean',
  showStaticText: 'boolean',
  showAllMultiInstanceValues: 'boolean',
  collapseStaticComponents: 'boolean',
  showSpinnerBeforeInit: 'boolean',

  readOnlyMode: 'boolean',
  hideEmptyFields: 'boolean',
  trustTemplateMarkup: 'boolean',

  showTemplateRenderingRepresentation: 'boolean',
  showMultiInstanceInfo: 'boolean',
  showTemplateSourceData: 'boolean',
  showTemplateYaml: 'boolean',
  showInstanceDataCore: 'boolean',
  showInstanceDataFull: 'boolean',
  showInstanceYaml: 'boolean',
  showDataQualityReport: 'boolean',
  showSampleTemplateLinks: 'boolean',
  expandedTemplateRenderingRepresentation: 'boolean',
  expandedMultiInstanceInfo: 'boolean',
  expandedTemplateSourceData: 'boolean',
  expandedTemplateYaml: 'boolean',
  expandedInstanceDataCore: 'boolean',
  expandedInstanceDataFull: 'boolean',
  expandedInstanceYaml: 'boolean',
  expandedDataQualityReport: 'boolean',
  expandedSampleTemplateLinks: 'boolean',

  inputSerialization: 'serialization',
  outputSerialization: 'serialization',

  terminologyIntegratedSearchUrl: 'string',
  extAuthBaseUrl: 'string',
  iriPrefix: 'string',
  bioPortalPrefix: 'string',
  orcidPrefix: 'string',
  rorPrefix: 'string',

  defaultLanguage: 'string',
  fallbackLanguage: 'string',
  languageMapPathPrefix: 'string',

  sampleTemplateLocationPrefix: 'string',
  loadSampleTemplateName: 'string',
};

/**
 * The per-authority endpoint overrides.
 *
 * Taken from the descriptors rather than matched by pattern, so `orcidIntegrated…`
 * is accepted and `orkidIntegrated…` is not. A pattern would have accepted both.
 */
const AUTHORITY_KEYS: ReadonlySet<string> = new Set(
  AUTHORITY_DESCRIPTORS.flatMap((descriptor) => [descriptor.searchUrlConfigKey, descriptor.detailsUrlConfigKey]),
);

const SERIALIZATIONS: ReadonlySet<string> = new Set(['json', 'yaml']);

/** Levenshtein distance, capped: only used to suggest a key the host probably meant. */
const distance = (a: string, b: string): number => {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const candidate = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = previous[j];
      previous[j] = candidate;
    }
  }
  return previous[b.length];
};

/** The known key closest to an unknown one, when there is a plausible candidate. */
const didYouMean = (key: string): string | null => {
  const known = [...Object.keys(CONFIG_SCHEMA), ...AUTHORITY_KEYS];
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of known) {
    const d = distance(key.toLowerCase(), candidate.toLowerCase());
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  // A third of the key's length, so a long key tolerates a bigger slip than a short
  // one and nothing unrelated is offered as a suggestion.
  return best !== null && bestDistance <= Math.max(2, Math.floor(key.length / 3)) ? best : null;
};

const describe = (value: unknown): string => (value === null ? 'null' : typeof value);

/**
 * Everything wrong with a configuration, as messages for the host.
 *
 * Returns them rather than reporting them, so the rules can be tested without a
 * message handler and so the caller decides how loud to be.
 */
export const validateCeeConfig = (config: unknown): string[] => {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return [`Configuration must be an object, but was ${describe(config)}. Ignored.`];
  }

  const problems: string[] = [];
  const entries = Object.entries(config as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (AUTHORITY_KEYS.has(key)) {
      if (typeof value !== 'string') {
        problems.push(`Configuration key "${key}" expects a string, but was ${describe(value)}. Ignored.`);
      }
      continue;
    }

    const expected = CONFIG_SCHEMA[key];
    if (expected === undefined) {
      const suggestion = didYouMean(key);
      problems.push(
        `Unknown configuration key "${key}". It has no effect.` + (suggestion ? ` Did you mean "${suggestion}"?` : ''),
      );
      continue;
    }

    if (expected === 'serialization') {
      if (typeof value !== 'string' || !SERIALIZATIONS.has(value)) {
        problems.push(`Configuration key "${key}" expects "json" or "yaml", but was ${JSON.stringify(value)}.`);
      }
      continue;
    }

    if (typeof value !== expected) {
      problems.push(`Configuration key "${key}" expects a ${expected}, but was ${describe(value)}. Ignored.`);
    }
  }

  problems.push(...combinationProblems(config as Record<string, unknown>));
  return problems;
};

/**
 * Settings that are individually valid and wrong together.
 *
 * Both of these are already true of CEE and were discoverable only by watching
 * nothing happen.
 */
const combinationProblems = (config: Record<string, unknown>): string[] => {
  const problems: string[] = [];

  if (config['hideEmptyFields'] === true && config['readOnlyMode'] !== true) {
    problems.push('Configuration key "hideEmptyFields" only takes effect in read-only mode, which is not enabled.');
  }

  // The reader appends an authority path to this, so a base without a trailing
  // slash silently produces `…/ext-authorcid/search-by-name`.
  const base = config['extAuthBaseUrl'];
  if (typeof base === 'string' && base !== '' && !base.endsWith('/')) {
    problems.push(`Configuration key "extAuthBaseUrl" must end in a slash, but was "${base}".`);
  }

  return problems;
};
