/**
 * Does our conformance check agree with the canonical one?
 *
 * `model-conformance.spec.ts` validates CEE's instances against their templates
 * with `ajv-draft-04`. `cedar-model-validation-library` does the same job in
 * Java with a different validator, and it is the arbiter. A claim like "31 of 37
 * conform" is only worth anything if the two agree about what conforming means.
 *
 * So this runs the canonical library's own instance fixtures — the seven it
 * requires to pass, and the nine mutations it requires to fail — through our
 * validator and checks we reach the same verdicts. Its `TemplateInstanceValidationTest`
 * is the specification being copied here, method for method.
 *
 * If a future CEDAR release tightens a rule that ajv does not implement, this is
 * where it shows up, rather than in a silently over-optimistic conformance
 * number.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv from 'ajv-draft-04';
import addFormats from 'ajv-formats';

/**
 * The fixtures are copied into this repo rather than read from a sibling checkout of
 * cedar-model-validation-library. That path only exists on a machine with the full CEDAR
 * tree, never in CI, so these tests skipped there while the run still reported green —
 * the agreement was verified only on developer machines. See the fixtures' README for
 * provenance and how to refresh them.
 */
const VALIDATOR_ROOT = path.resolve(__dirname, 'fixtures/canonical');

const read = (rel: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(VALIDATOR_ROOT, rel), 'utf8'));

/** Instance fixture and the template that is its schema, as the Java test pairs them. */
const PAIRS: [string, string, string][] = [
  ['single field', 'instances/single-field-instance.jsonld', 'templates/single-field-template.json'],
  ['annotations', 'instances/instance-with-annotations.jsonld', 'templates/template-allowing-annotations.json'],
  ['many fields', 'instances/many-fields-instance.jsonld', 'templates/many-fields-template.json'],
  [
    'multiple field items',
    'instances/multiple-field-items-instance.jsonld',
    'templates/multiple-field-items-template.json',
  ],
  [
    'multiple element items',
    'instances/multiple-element-items-instance.jsonld',
    'templates/multiple-element-items-template.json',
  ],
  ['nested element', 'instances/nested-element-instance.jsonld', 'templates/nested-element-template.json'],
  ['attribute value', 'instances/attribute-value-instance.jsonld', 'templates/attribute-value-template.json'],
];

/**
 * The keys the canonical suite removes one at a time, each of which must make
 * the instance invalid. This is the envelope, and it is why an instance missing
 * any part of it is not a CEDAR instance.
 */
const REQUIRED_KEYS = [
  '@context',
  '@id',
  'schema:name',
  'schema:description',
  'pav:createdOn',
  'pav:createdBy',
  'pav:lastUpdatedOn',
  'oslc:modifiedBy',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validatorFor = (schema: Record<string, unknown>): any => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ajv = new (Ajv as any)({ strict: false, allErrors: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addFormats(ajv as any);
  return ajv.compile(schema);
};

describe('our validator against the canonical fixtures', () => {
  it('every fixture the suite reads is present', () => {
    const missing = PAIRS.flatMap(([, instanceFile, templateFile]) => [instanceFile, templateFile]).filter(
      (f) => !fs.existsSync(path.join(VALIDATOR_ROOT, f)),
    );
    expect(missing, `copied fixtures are incomplete: ${missing.join(', ')}`).toEqual([]);
  });

  it.each(PAIRS)('%s: the instance the library requires to pass, passes', (_label, instanceFile, templateFile) => {
    const validate = validatorFor(read(templateFile));
    const valid = validate(read(instanceFile));
    expect(valid, `we reject an instance the canonical library accepts:\n  ${JSON.stringify(validate.errors)}`).toBe(
      true,
    );
  });

  /**
   * The mirror, and the more informative half: a validator that accepts
   * everything would pass the block above. The canonical suite removes each
   * required key in turn from `many-fields-instance` and requires the result to
   * be rejected, so we do the same.
   */
  it.each(REQUIRED_KEYS)('many fields: removing %s makes it invalid, as the library requires', (key) => {
    const validate = validatorFor(read('templates/many-fields-template.json'));
    const instance = read('instances/many-fields-instance.jsonld');
    delete instance[key];
    expect(validate(instance), `we accept an instance missing ${key}; the canonical library rejects it`).toBe(false);
  });

  it('many fields: removing a field makes it invalid', () => {
    const validate = validatorFor(read('templates/many-fields-template.json'));
    const instance = read('instances/many-fields-instance.jsonld');
    const fieldKey = Object.keys(instance).find((k) => !k.startsWith('@') && !k.includes(':'));
    expect(fieldKey, 'the fixture has no plain field to remove').toBeTruthy();
    delete instance[fieldKey as string];
    expect(validate(instance)).toBe(false);
  });
});
