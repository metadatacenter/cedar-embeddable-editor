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
        hideEmptyFields: true,
        outputSerialization: 'yaml',
        inputSerialization: 'json',
        extAuthBaseUrl: 'https://bridge.metadatacenter.org/ext-auth/',
        orcidIntegratedExtAuthUrl: 'orcid/search-by-name',
        nihGrantIntegratedDetailsUrl: 'nih-grant',
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
    expect(oneProblem({ showheader: true })).toContain('Did you mean "showHeader"?');
  });

  it('offers no suggestion when nothing is close', () => {
    expect(oneProblem({ completelyUnrelatedThing: 1 })).not.toContain('Did you mean');
  });

  /**
   * Taken from the descriptors rather than matched by shape, so a misspelled
   * authority is caught. A pattern like `/Integrated(ExtAuth|Details)Url$/` would
   * have accepted this.
   */
  it('catches a misspelled authority endpoint', () => {
    expect(oneProblem({ orkidIntegratedExtAuthUrl: 'x' })).toContain('Unknown configuration key');
  });
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

  it('restricts serialization to the two CEE writes', () => {
    expect(oneProblem({ outputSerialization: 'xml' })).toBe(
      'Configuration key "outputSerialization" expects "json" or "yaml", but was "xml".',
    );
  });

  it('checks authority endpoints are strings', () => {
    expect(oneProblem({ rorIntegratedDetailsUrl: 7 })).toContain('expects a string, but was number');
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
   * Both of these are how CEE already behaves. They were discoverable only by
   * setting something and watching nothing happen.
   */
  it('reports hiding empty fields without read-only mode', () => {
    expect(oneProblem({ hideEmptyFields: true })).toContain('only takes effect in read-only mode');
  });

  it('accepts the pair when read-only is on', () => {
    expect(problemsFor({ hideEmptyFields: true, readOnlyMode: true })).toEqual([]);
  });

  it('reports an authority base URL with no trailing slash', () => {
    expect(oneProblem({ extAuthBaseUrl: 'https://bridge.metadatacenter.org/ext-auth' })).toContain(
      'must end in a slash',
    );
  });

  it('accepts an empty base URL, which means "use the default"', () => {
    expect(problemsFor({ extAuthBaseUrl: '' })).toEqual([]);
  });
});

describe('several problems at once', () => {
  it('reports every one, rather than stopping at the first', () => {
    const problems = problemsFor({ readOnlyMode: 'yes', notAKey: 1, outputSerialization: 'xml' });
    expect(problems).toHaveLength(3);
  });
});
