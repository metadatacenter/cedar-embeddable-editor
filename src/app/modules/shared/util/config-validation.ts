/**
 * What CEE will say about a configuration a host handed it, and what it will read.
 *
 * The declarations the package ships describe this surface, and a TypeScript host
 * gets a compile error for a misspelled key or a wrong value. A JavaScript host has
 * no such protection, and used to be answered with silence — an unknown key is
 * simply never read, which looks exactly like a key that works.
 *
 * Both answers come from one pass, because for a while they disagreed. This said
 * "Ignored." and meant it as a description of the reader downstream, which coerces
 * instead: `readOnlyMode: 'false'` locked the form, since a non-empty string is
 * truthy; `terminologyBaseUrl: 7` built the endpoint `7bioportal/integrated-search`;
 * and a base URL missing its slash produced `…/terminologybioportal/…` and was used.
 * A message that says a value was ignored while the value takes effect is worse than
 * no message, so the check now decides what CEE reads rather than describing what it
 * hoped the reader did.
 *
 * One bad key still costs only that key. Refusing a whole configuration over one of
 * them would take an editor a host had configured acceptably and leave it with none,
 * and configuration is applied once, so there is nothing to fall back to.
 */

import { CEE_CONFIG_KEY } from './config-reader';

/** What a key's value has to be. */
type ExpectedType = 'boolean' | 'string';

/**
 * Every key CEE reads, and what it expects.
 *
 * The runtime counterpart to `CeeConfig`, which is an interface and so exists only
 * at compile time. `cee-public-api.spec.ts` holds the two together, along with the
 * shared runtime key map and its consumers, so they cannot drift.
 */
export const CONFIG_SCHEMA: Readonly<Record<string, ExpectedType>> = {
  [CEE_CONFIG_KEY.showTemplateDescription]: 'boolean',

  [CEE_CONFIG_KEY.readOnlyMode]: 'boolean',
  [CEE_CONFIG_KEY.trustTemplateRichText]: 'boolean',

  [CEE_CONFIG_KEY.showDownloadMenu]: 'boolean',
  [CEE_CONFIG_KEY.showExpandCollapseAll]: 'boolean',

  [CEE_CONFIG_KEY.terminologyBaseUrl]: 'string',
  [CEE_CONFIG_KEY.bridgeBaseUrl]: 'string',

  [CEE_CONFIG_KEY.defaultLanguage]: 'string',
  [CEE_CONFIG_KEY.fallbackLanguage]: 'string',
  [CEE_CONFIG_KEY.languageMapPathPrefix]: 'string',
};

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
  const known = Object.keys(CONFIG_SCHEMA);
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

/** What a value that failed the check reads as, which is the same as never sending it. */
const IGNORED = 'Ignored, and the key reads as unset.';

/**
 * A checked configuration: what to tell the host, and what CEE may read.
 *
 * `usable` is null only when the host handed over something that is not a
 * configuration at all. An object always yields one, possibly empty — a
 * configuration whose every key was refused still says "I want the defaults", which
 * is what an empty one says too.
 */
export interface CheckedCeeConfig {
  problems: string[];
  usable: Record<string, unknown> | null;
}

/**
 * Everything wrong with a configuration, and the part of it CEE will read.
 *
 * Returns both rather than reporting anything, so the rules can be tested without a
 * message handler and the caller decides how loud to be.
 */
export const checkCeeConfig = (config: unknown): CheckedCeeConfig => {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return { problems: [`Configuration must be an object, but was ${describe(config)}. Ignored.`], usable: null };
  }

  const problems: string[] = [];
  const usable: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    const expected = CONFIG_SCHEMA[key];
    if (expected === undefined) {
      const suggestion = didYouMean(key);
      problems.push(
        `Unknown configuration key "${key}". It has no effect.` + (suggestion ? ` Did you mean "${suggestion}"?` : ''),
      );
      continue;
    }

    if (typeof value !== expected) {
      problems.push(`Configuration key "${key}" expects a ${expected}, but was ${describe(value)}. ${IGNORED}`);
      continue;
    }

    usable[key] = value;
  }

  // Run over the survivors, so a key already refused for its type is not refused
  // twice for its shape.
  problems.push(...dropMisshapenValues(usable));
  return { problems, usable };
};

/**
 * Values of the right type that CEE still cannot use, removed from what it reads.
 *
 * Both keys naming a CEDAR server name the server and nothing below it, and CEE
 * appends the path it knows. A base without its trailing slash produced
 * `…/bridgeext-auth/orcid/…` or `…/terminologybioportal/integrated-search`, which
 * every request then 404s on in a way that reads as a broken server rather than a
 * missing character. CEE does not add the slash for the host: guessing at a URL
 * nobody wrote is how a deployment ends up talking to an endpoint no one chose,
 * whereas an unset base is a state CEE already has and already reports, as the
 * lookups being off.
 */
const dropMisshapenValues = (usable: Record<string, unknown>): string[] => {
  const problems: string[] = [];

  for (const key of ['bridgeBaseUrl', 'terminologyBaseUrl']) {
    const base = usable[key];
    if (typeof base === 'string' && base !== '' && !base.endsWith('/')) {
      problems.push(`Configuration key "${key}" must end in a slash, but was "${base}". ${IGNORED}`);
      delete usable[key];
    }
  }

  return problems;
};
