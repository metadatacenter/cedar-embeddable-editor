/**
 * CEE's save decision is the model library's.
 *
 * A host enables Save from `dataQualityReport.canSave`, and the server stores an
 * instance exactly when the library's validator, applied to the stored template,
 * finds nothing that blocks a save. The two must agree: a valid instance can always
 * be saved, and an invalid one never can. CEE adds structural problems of its own
 * to the library's, so agreement does not hold by construction, and a test that
 * asserts `canSave` for a handful of hand-written cases would not notice a rule that
 * refuses what the library accepts.
 *
 * So every state the matrix and corpus sweeps reach is judged twice. CEE answers
 * with its report once its pending checks have settled. The library answers for the
 * document a host receives, `emitted`, read back and validated against the template
 * as it is stored, as the server judges it.
 */
import { describe, expect, it } from 'vitest';
import { CedarReaders, InstanceValidator, JsonNode } from 'cedar-model-typescript-library';
import { CARDINALITIES, FIELD_KINDS, NESTINGS, POPULATION_NESTINGS } from '../src/axes';
import { buildTemplate, sweep } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { asSaved, ceeSuiteCases, corpusInstances, corpusTemplates, hubmapTemplates } from '../src/corpus';
import { instanceWith, templateIdOf } from '../src/values';

interface State {
  label: string;
  template: object;
  open: () => CeeDriver;
}

const VALUED = FIELD_KINDS.filter((kind) => !kind.isStatic);

const generated: State[] = [
  ...sweep(FIELD_KINDS, CARDINALITIES, NESTINGS).flatMap((c): State[] => [
    { label: `fresh ${c.label}`, template: c.template, open: () => new CeeDriver(c.template) },
    ...(c.kind.write === 'none'
      ? []
      : [
          {
            label: `filled ${c.label}`,
            template: c.template,
            open: () => {
              const driver = new CeeDriver(c.template);
              driver.setValue(c.path, c.kind);
              return driver;
            },
          },
        ]),
  ]),
  ...sweep(VALUED, CARDINALITIES, POPULATION_NESTINGS, { multiElementMinItems: 1, multiFieldMinItems: 1 }).map(
    (c): State => ({
      label: `placed ${c.label}`,
      template: c.template,
      open: () => {
        const driver = new CeeDriver(c.template);
        driver.setValue(c.path, c.kind);
        return driver;
      },
    }),
  ),
];

/**
 * Values a host can hand over in a stored instance, in shapes the field may not take.
 *
 * CEE's own structural rules judge these: a literal where an IRI belongs, an IRI where
 * a literal belongs, a label without its term, and the two empty spellings.
 */
const STORED_SHAPES: Record<string, object> = {
  literal: { '@value': 'A value' },
  iri: { '@id': 'https://example.org/value' },
  'opaque iri': { '@id': 'http:value' },
  'label alone': { 'rdfs:label': 'A label' },
  'empty object': {},
  'null literal': { '@value': null },
};

const stored: State[] = VALUED.filter((kind) => kind.write === 'value' || kind.write === 'controlled').flatMap(
  (kind) => {
    const template = buildTemplate({ name: `stored_${kind.key}`, children: [{ kind, name: 'f' }] });
    return Object.entries(STORED_SHAPES).map(([shape, value]): State => ({
      label: `stored ${kind.inputType} holding ${shape}`,
      template,
      open: () => new CeeDriver(template, { instance: { ...instanceWith(templateIdOf(template), {}), _f: value } }),
    }));
  },
);

const corpusById = new Map(corpusTemplates().map((artifact) => [artifact.id, asSaved(artifact)]));

const corpus: State[] = [
  ...[...corpusById].map(([id, template]): State => ({
    label: `corpus template ${id}`,
    template,
    open: () => new CeeDriver(template),
  })),
  ...corpusInstances()
    .filter((entry) => corpusById.has(entry.id))
    .map((entry): State => {
      const template = corpusById.get(entry.id)!;
      return {
        label: `corpus instance ${entry.id}`,
        template,
        open: () => new CeeDriver(template, { instance: entry.json }),
      };
    }),
  ...hubmapTemplates().map((artifact): State => ({
    label: `HuBMAP template ${artifact.id}`,
    template: artifact.json,
    open: () => new CeeDriver(artifact.json),
  })),
  ...ceeSuiteCases().flatMap((entry): State[] => {
    const template = entry.template;
    if (template === null) return [];
    return [
      { label: `lifecycle template ${entry.id}`, template, open: () => new CeeDriver(template) },
      ...(entry.instance === null
        ? []
        : [
            {
              label: `lifecycle instance ${entry.id}`,
              template,
              open: () => new CeeDriver(template, { instance: entry.instance as object }),
            },
          ]),
    ];
  }),
];

/** Whether the server would store `document`: the library reads it and judges it against the stored template. */
const libraryVerdict = (template: object, document: object) => {
  const parsedTemplate = CedarReaders.json()
    .getFebruary2024()
    .getTemplateReader()
    .readFromObject(template as JsonNode).template;
  const read = CedarReaders.json()
    .getFebruary2024()
    .getTemplateInstanceReader()
    .readFromObject(document as JsonNode);
  const report = InstanceValidator.validateReport(read.instance, parsedTemplate, template as JsonNode);
  const unread = read.parsingResult
    .getBlueprintComparisonErrors()
    .map((error) => `unread ${error.errorPath.toPointer()}`);
  return {
    canSave: report.canSave && unread.length === 0,
    blocking: [
      ...unread,
      ...report.findings.filter((finding) => finding.category === 'structural').map((f) => `${f.code} at ${f.path}`),
    ],
  };
};

const judge = async (state: State) => {
  const driver = state.open();
  await driver.settled();
  const report = driver.qualityReport;
  const cee = {
    canSave: report.canSave as boolean,
    blocking: report.problems
      .filter((problem: { blocksSave: boolean }) => problem.blocksSave)
      .map(
        (problem: { code: string; location?: string; path: string[] }) =>
          `${problem.code} at ${problem.location ?? '/' + problem.path.join('/')}`,
      ),
  };
  const emitted = driver.emitted as Record<string, unknown>;
  return { cee, emitted };
};

describe('CEE refuses a save exactly when the library would', () => {
  it('sweeps every state the matrix and the corpora reach', () => {
    expect(generated.length).toBeGreaterThan(450);
    expect(stored.length).toBeGreaterThan(60);
    expect(corpus.length).toBeGreaterThan(200);
  });

  it.each([...generated, ...stored, ...corpus].map((state) => [state.label, state] as const))(
    '%s',
    async (_label, state) => {
      const { cee, emitted } = await judge(state);
      if (Object.keys(emitted).length === 0) {
        // No document to send: a host reading `currentMetadata` has nothing to save.
        expect(cee.canSave, 'CEE offers a save of an empty document').toBe(false);
        return;
      }
      const library = libraryVerdict(state.template, emitted);
      expect(
        { canSave: cee.canSave, cee: cee.blocking, library: library.blocking },
        'CEE and the library disagree about saving the document CEE would write',
      ).toEqual({ canSave: library.canSave, cee: cee.blocking, library: library.blocking });
    },
  );
});
