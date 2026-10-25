import { describe, expect, it } from 'vitest';
import { CedarReaders, InstanceValidator, JsonNode } from 'cedar-model-typescript-library';
import type { InstanceObject } from '@cee/models/instance-node.model';
import { ceeSuiteCases } from '../src/corpus';
import { CeeDriver } from '../src/driver';
import { InstanceSerializer } from '@cee/util/instance-serializer';

type PathSegment = string | number;
type PairedCase = { id: string; template: object; instance: InstanceObject };

const allCases = ceeSuiteCases();
const templates = allCases.filter((entry): entry is typeof entry & { template: object } => entry.template !== null);
const paired = allCases.filter((entry): entry is PairedCase => entry.template !== null && entry.instance !== null);

// These documents predate a persisted repository envelope. CEE supplies the
// template link; the remaining five warnings are the null root @id and four
// provenance values the repository assigns on save.
const PRE_SAVE_ENVELOPE_WARNING_IDS = new Set([
  '004',
  '008',
  '009',
  '011',
  '012',
  '013',
  '015',
  '017',
  '018',
  '019',
  '020',
  '021',
  '024',
  '025',
  '026',
  '029',
  '030',
  '032',
  '034',
  '035',
  '036',
  '041',
  '042',
  '044',
  '046',
  '057',
  '060',
  '063',
  '066',
  '071',
  '085',
]);

const meaningfulLeaves = (value: unknown, path: PathSegment[] = []): Array<{ path: PathSegment[]; value: unknown }> => {
  // The template is authoritative for property IRIs and the writer rebuilds
  // this block. Values, identities, types, labels and provenance remain in the
  // comparison; only empty/null placeholders are not scientific content.
  if (path.length === 1 && path[0] === '@context') return [];
  if (Array.isArray(value)) return value.flatMap((child, index) => meaningfulLeaves(child, [...path, index]));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => meaningfulLeaves(child, [...path, key]));
  }
  if (value === null || value === '' || value === undefined) return [];
  return [{ path, value }];
};

const atPath = (value: unknown, path: PathSegment[]): unknown =>
  path.reduce<unknown>((current, segment) => (current as Record<string | number, unknown> | null)?.[segment], value);

const lifecycle = (entry: PairedCase) => {
  const driver = new CeeDriver(entry.template, { instance: entry.instance });
  const emitted = driver.emitted as Record<string, unknown>;
  const template = CedarReaders.json()
    .getFebruary2024()
    .getTemplateReader()
    .readFromObject(entry.template as JsonNode).template;
  const instanceResult = CedarReaders.json()
    .getFebruary2024()
    .getTemplateInstanceReader()
    .readFromObject(emitted as JsonNode);
  const validation = InstanceValidator.validate(instanceResult.instance, template);
  return { driver, emitted, instanceResult, validation };
};

describe('the production-derived CEE lifecycle corpus', () => {
  it('keeps the complete inventory and declares the one malformed template', () => {
    expect(allCases).toHaveLength(85);
    expect(allCases.filter((entry) => entry.instance !== null)).toHaveLength(57);
    expect(allCases.filter((entry) => entry.template === null).map((entry) => entry.id)).toEqual(['086']);
    expect(paired).toHaveLength(56);
  });

  it.each(templates.map((entry) => [entry.id, entry] as const))(
    'template %s creates a model-readable instance and reports inconsistent definitions',
    (id, entry) => {
      const driver = new CeeDriver(entry.template);
      const unsavedTemplateMessage =
        'Template has no @id, so instances of it cannot say which template they came from. ' +
        'This is a template that has never been saved.';
      // Template 048 is the one pre-save template in this corpus. It cannot
      // produce a saveable instance because no repository IRI exists to put in
      // schema:isBasedOn; CEE must report that limitation rather than quietly
      // handing the host an apparently complete document.
      expect(driver.messages.errors).toEqual(id === '048' ? [unsavedTemplateMessage] : []);
      if (id === '048') {
        // Both writers refuse an instance that names no template, and the host
        // reads an empty object as JSON and an empty string as YAML.
        const refusal = 'A template instance must name the template it is based on.';
        expect(() => InstanceSerializer.toJson(driver.instance)).toThrow(refusal);
        expect(() => InstanceSerializer.toYaml(driver.instance)).toThrow(refusal);
        expect(driver.emitted).toEqual({});
        expect(driver.emittedYaml).toBe('');
        return;
      }

      const emitted = driver.emitted;
      const parsedTemplate = CedarReaders.json()
        .getFebruary2024()
        .getTemplateReader()
        .readFromObject(entry.template as JsonNode).template;
      const parsedInstance = CedarReaders.json()
        .getFebruary2024()
        .getTemplateInstanceReader()
        .readFromObject(emitted as JsonNode);

      expect(parsedInstance.parsingResult.getBlueprintComparisonErrorCount()).toBe(0);
      expect(parsedInstance.parsingResult.getBlueprintComparisonWarningCount()).toBe(5);
      expect(
        InstanceValidator.validateReport(parsedInstance.instance, parsedTemplate)
          .findings.filter((finding) => finding.category === 'structural')
          .map(({ code, path }) => ({ code, path })),
      ).toEqual(
        id === '004'
          ? [0, 1].map((index) => ({
              code: 'templateConstraint',
              path: `/Number 2/${index}/_valueConstraints/decimalPlace`,
            }))
          : [],
      );
      if (id === '004') expect(driver.qualityReport.canSave).toBe(false);
    },
  );

  it.each(paired.map((entry) => [entry.id, entry] as const))(
    'case %s loads, preserves values, emits, and validates with only declared legacy findings',
    (id, entry) => {
      const { driver, emitted, instanceResult, validation } = lifecycle(entry);
      const templateId = (entry.template as Record<string, unknown>)['@id'];
      const originalBasedOn = (entry.instance as unknown as Record<string, unknown>)['schema:isBasedOn'];

      const expectedMessages =
        id === '016'
          ? [`Instance schema:isBasedOn is ${originalBasedOn}, but the loaded template is ${templateId}.`]
          : [];
      expect(driver.messages.errors).toEqual(expectedMessages);

      const lost = meaningfulLeaves(entry.instance).filter((leaf) => atPath(emitted, leaf.path) !== leaf.value);
      expect(lost, 'CEE changed or dropped a non-empty source value').toEqual([]);

      expect(instanceResult.parsingResult.getBlueprintComparisonErrorCount()).toBe(0);
      expect(instanceResult.parsingResult.getBlueprintComparisonWarningCount()).toBe(
        PRE_SAVE_ENVELOPE_WARNING_IDS.has(id) ? 5 : 0,
      );
      expect(emitted['schema:isBasedOn']).toBe(originalBasedOn ?? templateId);

      // Case 002 is an intentionally under-filled historical fixture: its
      // template requires ten repeated text slots and the source carries two.
      // CEE preserves those two rather than silently inventing eight values;
      // naming the exact inherited finding keeps it visible and self-expiring.
      const expectedValidation =
        id === '004'
          ? // Historical xsd:long fields declare decimalPlace=2. Keep the original artifact
            // visible and blocked; its populated occurrences do not repair the definition.
            [0, 1, 2].map((index) => ({
              code: 'templateConstraint',
              path: `/Number 2/${index}/_valueConstraints/decimalPlace`,
            }))
          : id === '029'
            ? [
                {
                  code: 'missingProperty',
                  path: '/Element with Several Fields, some Multi/1/Another text field/2/@value',
                },
              ]
            : id === '046'
              ? // Two element occurrences list {"@value": null} in an attribute-value field, where
                // only attribute names belong; the Java validator refuses the document for both.
                [1, 2].map((occurrence) => ({
                  code: 'valueShape',
                  path: `/Element 1/Element 2/0/Element 3/${occurrence}/Sample Attribute Value/0`,
                }))
              : [];
      const actualValidation = validation
        .getValidationReport()
        .findings.filter((finding) => finding.category === 'structural')
        .map(({ code, path }) => ({ code, path }));
      expect(actualValidation).toEqual(expectedValidation);
      if (id === '002')
        expect(validation.getValidationReport().findings).toContainEqual(
          expect.objectContaining({ code: 'minItems', path: '/Multi Text Field' }),
        );
      if (id === '004' || id === '029' || id === '046') expect(driver.qualityReport.canSave).toBe(false);
    },
  );
});
