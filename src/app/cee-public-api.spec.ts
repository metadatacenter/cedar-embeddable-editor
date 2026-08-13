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
import { DataQualityReport } from './modules/shared/models/data-quality-report.model';
import { ValidationProblem } from './modules/shared/validation/validation-problem.model';

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

/** The property names an interface declares, optional or not. */
const interfaceMembers = (name: string): string[] => {
  const source = fs.readFileSync(PUBLIC_API, 'utf8');
  const body = source.slice(source.indexOf(`export interface ${name} {`));
  return [...body.slice(0, body.indexOf('\n}')).matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\??:/gm)]
    .map(([, member]) => member)
    .sort();
};

/**
 * The report types against the objects a host actually receives.
 *
 * One direction only. Both interfaces are deliberately narrower than the classes
 * behind them — the report also carries CEE's internal working views, which are not
 * part of the contract — so a runtime property missing from the declaration is a
 * choice. A *declared* property missing at runtime is not: it type-checks in a host
 * and reads `undefined`, which is exactly how `problems` came to be published under
 * a name the report has never used.
 */
describe('the published report types and the objects behind them', () => {
  it('declare only members the report really has', () => {
    const report = new DataQualityReport() as unknown as Record<string, unknown>;
    const declared = interfaceMembers('CeeDataQualityReport');

    expect(declared.length, 'the CeeDataQualityReport members were not parsed').toBeGreaterThan(3);
    expect(
      declared.filter((member) => !(member in report)),
      'CeeDataQualityReport declares a member DataQualityReport does not have',
    ).toEqual([]);
  });

  it('declare only members a problem really has', () => {
    const problem = new ValidationProblem([], 'field', null, 'code', 'message') as unknown as Record<string, unknown>;
    const declared = interfaceMembers('CeeValidationProblem');

    expect(declared.length, 'the CeeValidationProblem members were not parsed').toBeGreaterThan(3);
    expect(
      declared.filter((member) => !(member in problem)),
      'CeeValidationProblem declares a member ValidationProblem does not have',
    ).toEqual([]);
  });
});

/**
 * The combined input's members against the names the editor destructures.
 *
 * The one input whose *shape* a host has to get right rather than its type: the
 * other two take an artifact whole. A wrong member name here type-checks in the
 * host, arrives as `undefined` in the editor, and comes back as "Template Object
 * is missing." — which is how this interface was published for a while declaring
 * `template` and `instance` against a setter reading `templateObject` and
 * `instanceObject`.
 */
describe('the published combined input and the one the editor reads', () => {
  it('name the same members', () => {
    const source = fs.readFileSync(COMPONENT, 'utf8');
    const destructured = source.match(/const \{([^}]+)\} = templateAndInstance;/);

    expect(destructured, 'the templateAndInstanceObject setter no longer destructures').not.toBeNull();
    const implemented = (destructured as RegExpMatchArray)[1]
      .split(',')
      .map((member) => member.trim())
      .sort();

    expect(implemented.length, 'the destructured members were not parsed').toBe(2);
    expect(
      interfaceMembers('CeeTemplateAndInstance'),
      'CeeTemplateAndInstance names members the editor never reads',
    ).toEqual(implemented);
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
