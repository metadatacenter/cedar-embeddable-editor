/**
 * The published contract against the code that implements it.
 *
 * The public side is read from source because `CeeConfig` is an interface and does
 * not exist at runtime. The implementation side is the shared runtime key map, and
 * the readers are scanned to prove every key in that map is actually consumed. That
 * leaves lists that can still be edited independently, which is the condition this
 * test exists for — the same reason `import-boundaries.spec.ts` guards a property no
 * type can express.
 *
 * A key added to the component but not to `CeeConfig` would be invisible to a
 * host's compiler; one on `CeeConfig` that the component never reads would be a
 * documented setting that does nothing.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_SCHEMA } from './modules/shared/util/config-validation';
import { CEE_CONFIG_KEY } from './modules/shared/util/config-reader';
import { DataQualityReport } from './modules/shared/models/data-quality-report.model';
import { ValidationProblem } from './modules/shared/validation/validation-problem.model';

const COMPONENT = path.resolve(
  __dirname,
  'modules/shared/components/cedar-embeddable-metadata-editor/cedar-embeddable-metadata-editor.component.ts',
);
const PUBLIC_API = path.resolve(__dirname, 'cee-public-api.ts');
const ARTIFACT_COORDINATOR = path.resolve(__dirname, 'modules/shared/util/artifact-input-coordinator.ts');
const CONFIG_COORDINATOR = path.resolve(__dirname, 'modules/shared/util/wrapper-config-coordinator.ts');

/**
 * The keys the two runtime config consumers actually read, resolved through the
 * shared key map rather than repeated string literals.
 */
const componentKeys = (): string[] => {
  const source = [COMPONENT, CONFIG_COORDINATOR].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const names = [...source.matchAll(/CEE_CONFIG_KEY\.([a-zA-Z][a-zA-Z0-9]*)/g)].map(([, name]) => name);
  return [...new Set(names)].map((name) => CEE_CONFIG_KEY[name as keyof typeof CEE_CONFIG_KEY]).sort();
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

    /*
     * Both sides are read by regex, so the comparison below would pass vacuously
     * if either parse returned nothing. Named keys rather than a count: a count is
     * a second thing to maintain, and it has already had to move three times as
     * the surface shrank — each time saying nothing about whether the parse worked.
     * These two are the last keys that would ever be removed.
     */
    expect(declared, 'the CeeConfig properties were not parsed').toContain('readOnlyMode');
    expect(implemented, 'the runtime config reads were not parsed').toContain('readOnlyMode');
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
 * Both directions, for both interfaces. A *declared* member missing at runtime
 * type-checks in a host and reads `undefined`, which is how `problems` came to be
 * published under a name the report has never used. A member carried at runtime
 * and undeclared needs a cast to read, which is how `field` and `inputType` were
 * taught by the validation guide and unreachable from TypeScript.
 *
 * The report was checked in one direction only while it carried three of CEE's
 * internal working views alongside the contract, so an undeclared member was a
 * deliberate withholding rather than an omission. It carries nothing but the
 * contract now, and this is what keeps that true: adding a working view back to
 * `DataQualityReport` fails here rather than reaching a host.
 */
describe('the published report types and the objects behind them', () => {
  it('declare every member the report has, and only those', () => {
    const report = new DataQualityReport() as unknown as Record<string, unknown>;
    const carried = Object.getOwnPropertyNames(report);
    const declared = interfaceMembers('CeeDataQualityReport');

    expect(declared.length, 'the CeeDataQualityReport members were not parsed').toBeGreaterThan(3);
    expect(
      declared.filter((member) => !(member in report)),
      'CeeDataQualityReport declares a member DataQualityReport does not have',
    ).toEqual([]);
    expect(
      carried.filter((member) => !declared.includes(member)),
      'DataQualityReport carries a member CeeDataQualityReport does not declare, so a host receives an internal view',
    ).toEqual([]);
  });

  it('declare every member a problem has, and only those', () => {
    const problem = new ValidationProblem([], 'field', null, 'code', 'message') as unknown as Record<string, unknown>;
    const carried = Object.getOwnPropertyNames(problem);
    const declared = interfaceMembers('CeeValidationProblem');

    expect(declared.length, 'the CeeValidationProblem members were not parsed').toBeGreaterThan(3);
    expect(
      declared.filter((member) => !(member in problem)),
      'CeeValidationProblem declares a member ValidationProblem does not have',
    ).toEqual([]);
    expect(
      carried.filter((member) => !declared.includes(member)),
      'ValidationProblem carries a member CeeValidationProblem does not declare, so a host needs a cast to read it',
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
    const source = fs.readFileSync(ARTIFACT_COORDINATOR, 'utf8');
    const destructured = source.match(/const \{([^}]+)\} = value;/);

    expect(destructured, 'the artifact coordinator no longer destructures the combined input').not.toBeNull();
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
