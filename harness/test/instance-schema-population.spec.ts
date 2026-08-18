import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CARDINALITIES, FIELD_KINDS, POPULATION_NESTINGS } from '../src/axes';
import { sweep } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { validateWithModel, validateWithRawSchema } from '../src/instance-conformance';

/**
 * The saveability matrix.
 *
 * Each value-bearing field is populated through the real CEE handler and the
 * resulting JSON-LD is judged twice: first by the model library, then by the
 * exact raw Draft-04 schema that the resource server uses.  Field cardinality
 * is crossed with every single/multiple element placement through two levels.
 * Multi containers use one required occurrence so every generated slot can be
 * populated; minItems padding and partially-filled forms have their own suites.
 */
const VALUED = FIELD_KINDS.filter((kind) => !kind.isStatic);
const CASES = sweep(VALUED, CARDINALITIES, POPULATION_NESTINGS, {
  multiElementMinItems: 1,
  multiFieldMinItems: 1,
});

/**
 * The artifact server mints occurrence IDs before validating an instance.
 * Production-era element schemas often require a string while CEE correctly
 * submits null for the server-owned identifier, so reproduce that one server
 * normalization when validating an old captured template locally.
 */
const withServerMintedElementIds = (template: object, instance: object): object => {
  const copy = structuredClone(instance) as Record<string, unknown>;
  let sequence = 0;

  const walk = (schemaNode: unknown, instanceNode: unknown): void => {
    if (
      schemaNode === null ||
      typeof schemaNode !== 'object' ||
      instanceNode === null ||
      typeof instanceNode !== 'object'
    )
      return;
    const schema = schemaNode as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown> | undefined;
    if (!properties) return;
    for (const [key, declared] of Object.entries(properties)) {
      if (declared === null || typeof declared !== 'object') continue;
      const outer = declared as Record<string, unknown>;
      const childSchema = (outer.type === 'array' && outer.items ? outer.items : outer) as Record<string, unknown>;
      const childInstance = (instanceNode as Record<string, unknown>)[key];
      if (childSchema['@type'] !== 'https://schema.metadatacenter.org/core/TemplateElement') continue;
      const occurrences = Array.isArray(childInstance) ? childInstance : [childInstance];
      for (const occurrence of occurrences) {
        if (occurrence === null || typeof occurrence !== 'object') continue;
        const element = occurrence as Record<string, unknown>;
        if (element['@id'] === null || element['@id'] === undefined) {
          sequence++;
          element['@id'] = `https://repo.metadatacenter.org/template-element-instances/test-${sequence}`;
        }
        walk(childSchema, element);
      }
    }
  };

  walk(template, copy);
  return copy;
};

describe('populated instances are saveable against their exact templates', () => {
  it('covers every value-bearing field and every element placement', () => {
    expect(new Set(CASES.map((c) => c.kind.key))).toEqual(new Set(VALUED.map((kind) => kind.key)));
    expect(new Set(CASES.map((c) => c.nesting))).toEqual(new Set(POPULATION_NESTINGS));
  });

  it.each(CASES.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const driver = new CeeDriver(c.template);
    driver.setValue(c.path, c.kind);
    driver.expectNoErrors(`populating ${c.label}`);

    const emitted = driver.emitted;
    const model = validateWithModel(c.template, emitted);
    expect(model.count, `model validation: ${model.detail}`).toBe(0);

    const raw = validateWithRawSchema(c.template, emitted);
    expect(raw.count, `raw Draft-04 validation: ${raw.detail}`).toBe(0);
  });

  it('reproduces the five multi-select placements in the reported nested template', () => {
    const template = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../visual/fixtures/18-real-nested.json'), 'utf8'),
    ) as object;
    const list = FIELD_KINDS.find((kind) => kind.key === 'listMulti')!;
    const driver = new CeeDriver(template);
    for (const fieldPath of [
      ['t_multi_select_list_field'],
      ['all_single', 's_multi_select_list_field'],
      ['all_multi', 'm_multi_select_list_field'],
      ['single_wrapper', 'nested_all_single', 'ns_multi_select_list_field'],
      ['multi_wrapper', 'nested_all_multi', 'nm_multi_select_list_field'],
    ]) {
      driver.setValue(fieldPath, list, 'Option B');
    }
    driver.expectNoErrors('populating the reported nested multi-select template');

    const raw = validateWithRawSchema(template, withServerMintedElementIds(template, driver.emitted));
    expect(raw.count, raw.detail).toBe(0);
  });
});
