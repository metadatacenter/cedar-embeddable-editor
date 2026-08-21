/**
 * What CEE tells a host about a configuration it cannot use.
 *
 * The interesting case is the one a type system cannot reach: a JavaScript host,
 * whose configuration has been checked by nobody. It used to be answered with
 * silence, and a key that is silently ignored looks exactly like a key that works.
 *
 * In the harness rather than beside the source, because the validator is plain
 * TypeScript that touches no framework and no DOM — which is exactly what this
 * suite is for, and what keeps `shared/util` above its coverage floor honestly
 * rather than by an exclusion.
 */
import { describe, expect, it } from 'vitest';
import { checkCeeConfig } from '@cee/util/config-validation';

const problemsFor = (config: unknown): string[] => checkCeeConfig(config).problems;
/** What CEE will read, which for a refused key has to be nothing. */
const usableFor = (config: unknown): Record<string, unknown> | null => checkCeeConfig(config).usable;
const oneProblem = (config: unknown): string => {
  const problems = problemsFor(config);
  expect(problems, `expected exactly one problem, got ${JSON.stringify(problems)}`).toHaveLength(1);
  return problems[0];
};

describe('a configuration CEE can use', () => {
  it('reports nothing for an empty object', () => {
    expect(problemsFor({})).toEqual([]);
    expect(usableFor({})).toEqual({});
  });

  it('reports nothing for every kind of key set correctly', () => {
    expect(
      problemsFor({
        readOnlyMode: true,
        bridgeBaseUrl: 'https://bridge.metadatacenter.org/',
        terminologyBaseUrl: 'https://terminology.metadatacenter.org/',
        languageMapPathPrefix: '/assets/i18n-cee/',
        defaultLanguage: 'en',
      }),
    ).toEqual([]);
  });

  it('hands every correctly set key through untouched', () => {
    const config = { readOnlyMode: true, defaultLanguage: 'en', bridgeBaseUrl: 'https://bridge.example.org/' };
    expect(usableFor(config)).toEqual(config);
  });
});

describe('a key CEE does not know', () => {
  it('is named, and said to have no effect', () => {
    expect(oneProblem({ notAKey: true })).toContain('Unknown configuration key "notAKey"');
  });

  it('suggests the key that was probably meant', () => {
    expect(oneProblem({ readOnlyMod: true })).toContain('Did you mean "readOnlyMode"?');
    expect(oneProblem({ showdownloadmenu: true })).toContain('Did you mean "showDownloadMenu"?');
  });

  it('offers no suggestion when nothing is close', () => {
    expect(oneProblem({ completelyUnrelatedThing: 1 })).not.toContain('Did you mean');
  });

  /**
   * The fourteen per-authority endpoint keys are gone: seven search paths and
   * seven details paths, each of which every host set to the value CEE already
   * uses. Both now hang off `bridgeBaseUrl`, so a host still naming one is told
   * it is no longer read rather than left to assume it works.
   */
  it.each([['orcidIntegratedExtAuthUrl'], ['orcidIntegratedDetailsUrl'], ['nihGrantIntegratedExtAuthUrl']])(
    'reports the retired key %s',
    (key) => {
      expect(oneProblem({ [key]: 'orcid' })).toContain(`Unknown configuration key "${key}"`);
    },
  );
});

describe('a key set to the wrong kind of value', () => {
  it('says what was expected and what arrived', () => {
    expect(oneProblem({ readOnlyMode: 'yes' })).toBe(
      'Configuration key "readOnlyMode" expects a boolean, but was string. Ignored, and the key reads as unset.',
    );
  });

  /**
   * The half that the message used only to claim. `readOnlyMode: 'false'` is the
   * case that made this a defect rather than a wording problem: the reader coerces,
   * a non-empty string is truthy, and a host asking for a form that is *not* read
   * only got one that was — under a message saying the key had been ignored.
   */
  it.each([
    ['readOnlyMode', 'false'],
    ['readOnlyMode', 'yes'],
    ['showDownloadMenu', 1],
    ['bridgeBaseUrl', 7],
    ['languageMapPathPrefix', null],
  ])('keeps %s out of what CEE reads when it arrives as the wrong type', (key, value) => {
    expect(usableFor({ [key]: value })).toEqual({});
  });

  it('refuses only the key that is wrong', () => {
    expect(usableFor({ readOnlyMode: 'false', defaultLanguage: 'hu' })).toEqual({ defaultLanguage: 'hu' });
  });

  it('describes null as null rather than as an object', () => {
    expect(oneProblem({ languageMapPathPrefix: null })).toContain('but was null');
  });

  it('checks a server base URL is a string', () => {
    expect(oneProblem({ bridgeBaseUrl: 7 })).toContain('expects a string, but was number');
    expect(oneProblem({ terminologyBaseUrl: 7 })).toContain('expects a string, but was number');
  });
});

describe('a configuration that is not an object at all', () => {
  it.each([
    ['null', null],
    ['a string', 'readOnlyMode'],
    ['an array', [{ readOnlyMode: true }]],
  ])('is reported rather than iterated: %s', (_label, value) => {
    expect(oneProblem(value)).toContain('Configuration must be an object');
  });

  /**
   * Null, and not an empty configuration: the two mean different things to the
   * element. An empty configuration is a host asking for the defaults and spends the
   * one assignment there is; null is a host that has not configured anything yet, so
   * its next attempt is still its first.
   */
  it.each([
    ['null', null],
    ['a string', 'readOnlyMode'],
    ['an array', [{ readOnlyMode: true }]],
  ])('leaves CEE nothing to read: %s', (_label, value) => {
    expect(usableFor(value)).toBeNull();
  });
});

describe('settings that are each valid and wrong together', () => {
  /**
   * How CEE already behaves, discoverable only by setting something and watching
   * nothing happen.
   */
  it.each([['bridgeBaseUrl'], ['terminologyBaseUrl']])('reports %s with no trailing slash', (key) => {
    expect(oneProblem({ [key]: 'https://bridge.metadatacenter.org/ext-auth' })).toContain('must end in a slash');
  });

  /**
   * And drops it, rather than letting CEE append its own path to it. The endpoint
   * that used to come out of this — `…/ext-authorcid/search` — 404s on every
   * request, which reads as a broken server rather than as a missing character.
   */
  it.each([['bridgeBaseUrl'], ['terminologyBaseUrl']])('keeps a slashless %s out of what CEE reads', (key) => {
    expect(usableFor({ [key]: 'https://bridge.metadatacenter.org/ext-auth' })).toEqual({});
  });

  it('does not invent the missing slash', () => {
    const usable = usableFor({ terminologyBaseUrl: 'https://terminology.example.org' });
    expect(usable).not.toHaveProperty('terminologyBaseUrl');
  });

  /**
   * Empty means the host named no server, which turns that lookup off.
   *
   * Not a problem to report here: the service that would have used it says so
   * once, when a field actually asks, and names the key. This used to mean "use
   * the default", back when there was one to fall back to.
   */
  it.each([['bridgeBaseUrl'], ['terminologyBaseUrl']])('accepts an empty %s', (key) => {
    expect(problemsFor({ [key]: '' })).toEqual([]);
    expect(usableFor({ [key]: '' })).toEqual({ [key]: '' });
  });
});

describe('several problems at once', () => {
  it('reports every one, rather than stopping at the first', () => {
    const problems = problemsFor({ readOnlyMode: 'yes', notAKey: 1, languageMapPathPrefix: 7 });
    expect(problems).toHaveLength(3);
  });

  it('reports a key once, for the first thing wrong with it', () => {
    // Wrong type *and* slashless. The type check refuses it, so the shape check
    // never sees it and the host is told one thing rather than two.
    expect(problemsFor({ terminologyBaseUrl: 7 })).toHaveLength(1);
  });
});
