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
import { validateCeeConfig } from '@cee/util/config-validation';

const problemsFor = (config: unknown): string[] => validateCeeConfig(config);
const oneProblem = (config: unknown): string => {
  const problems = problemsFor(config);
  expect(problems, `expected exactly one problem, got ${JSON.stringify(problems)}`).toHaveLength(1);
  return problems[0];
};

describe('a configuration CEE can use', () => {
  it('reports nothing for an empty object', () => {
    expect(problemsFor({})).toEqual([]);
  });

  it('reports nothing for every kind of key set correctly', () => {
    expect(
      problemsFor({
        readOnlyMode: true,
        bridgeBaseUrl: 'https://bridge.metadatacenter.org/',
        terminologyBaseUrl: 'https://terminology.metadatacenter.org/',
        iriPrefix: 'https://repo.metadatacenter.org/',
        defaultLanguage: 'en',
      }),
    ).toEqual([]);
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
      'Configuration key "readOnlyMode" expects a boolean, but was string. Ignored.',
    );
  });

  it('describes null as null rather than as an object', () => {
    expect(oneProblem({ iriPrefix: null })).toContain('but was null');
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
   * Empty means the host named no server, which turns that lookup off.
   *
   * Not a problem to report here: the service that would have used it says so
   * once, when a field actually asks, and names the key. This used to mean "use
   * the default", back when there was one to fall back to.
   */
  it.each([['bridgeBaseUrl'], ['terminologyBaseUrl']])('accepts an empty %s', (key) => {
    expect(problemsFor({ [key]: '' })).toEqual([]);
  });
});

describe('several problems at once', () => {
  it('reports every one, rather than stopping at the first', () => {
    const problems = problemsFor({ readOnlyMode: 'yes', notAKey: 1, iriPrefix: 7 });
    expect(problems).toHaveLength(3);
  });
});
