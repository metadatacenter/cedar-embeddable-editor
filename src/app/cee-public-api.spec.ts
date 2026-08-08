/**
 * The published contract against the code that implements it.
 *
 * Both sides are read from source, because neither exists at runtime: `CeeConfig`
 * is an interface, and the keys it describes are private statics on a component the
 * public API deliberately does not import. That leaves two lists that can be edited
 * independently, which is the condition this test exists for — the same reason
 * `import-boundaries.spec.ts` guards a property no type can express.
 *
 * A key added to the component but not to `CeeConfig` would be invisible to a
 * host's compiler; one on `CeeConfig` that the component never reads would be a
 * documented setting that does nothing.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_SCHEMA } from './modules/shared/util/config-validation';

const COMPONENT = path.resolve(
  __dirname,
  'modules/shared/components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component.ts',
);
const PUBLIC_API = path.resolve(__dirname, 'cee-public-api.ts');

/**
 * The string literals the component declares as configuration keys.
 *
 * `SERIALIZATION_YAML` is excluded: it is a configuration *value* — what
 * `outputSerialization` may be set to — rather than a key, and it is the only
 * static of that shape.
 */
const componentKeys = (): string[] => {
  const source = fs.readFileSync(COMPONENT, 'utf8');
  return [...source.matchAll(/static ([A-Z_]+)(?:: string)? = '([a-zA-Z]+)';/g)]
    .filter(([, name]) => name !== 'SERIALIZATION_YAML')
    .map(([, , value]) => value)
    .sort();
};

/** The optional property names declared on `CeeConfig`, ignoring its index signature. */
const declaredKeys = (): string[] => {
  const source = fs.readFileSync(PUBLIC_API, 'utf8');
  const body = source.slice(source.indexOf('export interface CeeConfig {'));
  return [...body.slice(0, body.indexOf('\n}')).matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\?:/gm)]
    .map(([, name]) => name)
    .sort();
};

describe('the published config keys and the ones the editor reads', () => {
  it('are the same set', () => {
    const declared = declaredKeys();
    const implemented = componentKeys();

    expect(declared.length, 'the CeeConfig properties were not parsed').toBeGreaterThan(30);
    expect(
      implemented.filter((key) => !declared.includes(key)),
      'the editor reads a key that CeeConfig does not declare',
    ).toEqual([]);
    expect(
      declared.filter((key) => !implemented.includes(key)),
      'CeeConfig declares a key the editor never reads',
    ).toEqual([]);
  });

  /**
   * A third list, and the only one that exists at runtime.
   *
   * `CONFIG_SCHEMA` is what the boundary validator checks a host's configuration
   * against, so a key missing from it is reported to that host as unknown — the
   * loudest possible way for these to disagree.
   */
  it('match the schema the runtime validator uses', () => {
    const scheme = Object.keys(CONFIG_SCHEMA).sort();
    const implemented = componentKeys();

    expect(
      implemented.filter((key) => !scheme.includes(key)),
      'the editor reads a key the validator would report as unknown',
    ).toEqual([]);
    expect(
      scheme.filter((key) => !implemented.includes(key)),
      'the validator accepts a key the editor never reads',
    ).toEqual([]);
  });
});

describe('the published declarations', () => {
  /**
   * The bundle is an IIFE that registers a custom element and exports nothing, so a
   * value declared here would satisfy a host's compiler and be `undefined` at
   * runtime. Types are the only thing this package can honestly publish until it
   * exports something.
   */
  it('declare no runtime values', () => {
    const source = fs.readFileSync(PUBLIC_API, 'utf8');
    const values = [...source.matchAll(/^export (?:const|function|class|let|var|enum) (\w+)/gm)].map(
      ([, name]) => name,
    );
    expect(values, 'the shipped bundle cannot back a runtime export').toEqual([]);
  });
});
