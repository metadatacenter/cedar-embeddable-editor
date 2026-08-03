/**
 * CEE against the real CEDAR artifact corpus.
 *
 * Every other suite here generates its own templates with the CEDAR Model
 * TypeScript Library. That is deliberate — it buys coverage of the axes CEE
 * branches on that no corpus could — but it means CEE has only ever been fed
 * input that library produced. These fixtures were authored by people and by
 * the CEDAR Template Editor.
 *
 * The immediate value is that real templates contain shapes a generator does
 * not think to emit: the very first run of this suite found CEE crashing on
 * `template-003`, whose `_ui.order` names a child `properties` does not define.
 *
 * The larger value is prospective. If CEE ever parses templates *with* the
 * model library, the generated suites will have that library on both sides of
 * every comparison and will agree with themselves whether or not either side
 * matches the spec. These fixtures are the only input here independent of it,
 * so they are what keeps that refactor honest. The snapshots below exist to be
 * diffed across exactly that change.
 */
import { describe, expect, it } from 'vitest';
import {
  corpusAvailable,
  corpusInstances,
  corpusTemplates,
  describeTree,
  hubmapAvailable,
  hubmapTemplates,
} from '../src/corpus';
import { CeeDriver } from '../src/driver';

const templates = corpusAvailable() ? corpusTemplates() : [];
const instances = corpusAvailable() ? corpusInstances() : [];

/**
 * Corpus templates CEE has something to say about, and what it says.
 *
 * Listed rather than tolerated silently: CEE recovers from both of these
 * instead of throwing, but it does report them, and a blanket "no errors"
 * assertion across the corpus would either fail here or have to be weakened
 * everywhere. Naming the two keeps the assertion strict for the other 35.
 *
 * `003` is malformed — its `_ui.order` names a child `properties` does not
 * define. `001` is not malformed, it is unsaved: its readme says so, and a
 * template with no `@id` means every instance built from it cannot name the
 * template it came from.
 */
const KNOWN_REPORTED: Record<string, string> = {
  '001': 'no @id',
  '003': 'TextfieldOrder',
};

describe.skipIf(!corpusAvailable())('real corpus templates', () => {
  it('the corpus is present and non-trivial', () => {
    expect(templates.length).toBeGreaterThan(30);
  });

  it.each(templates.map((t) => [t.id, t] as const))('template-%s parses', (_id, artifact) => {
    const driver = new CeeDriver(artifact.json);
    expect(driver.representation).toBeTruthy();

    const expected = KNOWN_REPORTED[artifact.id];
    if (expected) {
      // Recovers, and says why.
      expect(driver.messages.errors.join(' ')).toContain(expected);
    } else {
      driver.expectNoErrors(`parsing template-${artifact.id}`);
    }
  });

  /**
   * A structural fingerprint per template, checked in.
   *
   * Not the whole representation — that carries object identity, cursors and
   * back-references, and would churn on changes that mean nothing. This records
   * what a reader of the form would notice: structure, types, cardinality,
   * constraints. A change of parsing implementation must not move it.
   */
  it.each(templates.map((t) => [t.id, t] as const))('template-%s has a stable component tree', (id, artifact) => {
    const driver = new CeeDriver(artifact.json);
    // An explicit marker rather than an empty file: three corpus templates
    // legitimately render nothing — one is empty, two hold a single
    // `_ui.hidden` field — and a blank snapshot cannot be told apart from one
    // that failed to write.
    const tree = describeTree(driver.representation).join('\n') || '(no rendered children)';
    expect(tree).toMatchFileSnapshot(`./__snapshots__/corpus/template-${id}.txt`);
  });

  it.each(templates.map((t) => [t.id, t] as const))('template-%s builds an instance skeleton', (_id, artifact) => {
    const driver = new CeeDriver(artifact.json);
    expect(driver.metadata).toBeTruthy();
    expect(driver.extract).toBeTruthy();
  });

  it.each(templates.map((t) => [t.id, t] as const))('template-%s produces a quality report', (_id, artifact) => {
    const driver = new CeeDriver(artifact.json);
    expect(driver.qualityReport).toBeTruthy();
    expect(typeof driver.qualityReport.isValid).toBe('boolean');
  });
});

describe.skipIf(!corpusAvailable())('real corpus instances', () => {
  it('the corpus is present and non-trivial', () => {
    expect(instances.length).toBeGreaterThan(15);
  });

  /**
   * An instance loaded without its template still has to be survivable. CEE is
   * handed both together in practice, but the corpus does not pair them, and a
   * host page can inject an instance whose template it got separately.
   */
  it.each(instances.map((i) => [i.id, i] as const))('instance-%s can be injected', (_id, artifact) => {
    // A minimal template: the point is that instance loading does not throw on
    // shapes the generator never produces.
    const template = {
      '@type': 'https://schema.metadatacenter.org/core/Template',
      type: 'object',
      _ui: { order: [], propertyLabels: {}, propertyDescriptions: {} },
      // `@context` sits inside `properties`; that is where addContext looks.
      properties: { '@context': { properties: {} } },
      'schema:name': 'Minimal',
      'schema:description': '',
    };
    expect(() => new CeeDriver(template, { instance: artifact.json })).not.toThrow();
  });
});

describe.skipIf(!corpusAvailable())('templates the generator would not produce', () => {
  /**
   * REGRESSION: `_ui.order` may name a child that `properties` does not define.
   *
   * `template-003` does exactly that — it lists `TextfieldOrder`, which has no
   * property. The factory dereferenced `properties[name].type` unguarded and
   * threw, taking down the editor over a template the model library reads
   * without complaint. The orphan is now skipped and reported.
   */
  it('skips an _ui.order entry with no matching property', () => {
    const template = {
      '@type': 'https://schema.metadatacenter.org/core/Template',
      type: 'object',
      _ui: { order: ['Real', 'Orphan'], propertyLabels: {}, propertyDescriptions: {} },
      properties: {
        '@context': { properties: {} },
        Real: {
          '@type': 'https://schema.metadatacenter.org/core/TemplateField',
          type: 'object',
          _ui: { inputType: 'textfield' },
        },
      },
      'schema:name': 'Orphan order entry',
      'schema:description': '',
    };

    const driver = new CeeDriver(template);
    expect(driver.representation.children.map((c: any) => c.name)).toEqual(['Real']);
    // Reported rather than swallowed — the template is malformed and someone
    // should hear about it.
    expect(driver.messages.errors.join(' ')).toContain('Orphan');
  });

  it('parses template-003, which is the real instance of that shape', () => {
    const artifact = templates.find((t) => t.id === '003');
    expect(artifact, 'template-003 missing from the corpus').toBeTruthy();
    const driver = new CeeDriver(artifact!.json);
    expect(driver.representation.children.length).toBeGreaterThan(0);
  });
});

/**
 * The HuBMAP production templates.
 *
 * The numbered corpus above is a set of small, deliberate test fixtures. These
 * are 57 templates people actually authored and used — deep element nesting,
 * controlled terms throughout, and the long tail of `_ui` metadata a generator
 * never thinks to emit. If CEE is going to hand its parsing to the model
 * library, these are the input that will say whether anything moved.
 */
const hubmap = hubmapAvailable() ? hubmapTemplates() : [];

describe.skipIf(!hubmapAvailable())('HuBMAP production templates', () => {
  it('the corpus is present and non-trivial', () => {
    expect(hubmap.length).toBeGreaterThan(50);
  });

  it.each(hubmap.map((t) => [t.id, t] as const))('%s parses without error', (_id, artifact) => {
    const driver = new CeeDriver(artifact.json);
    expect(driver.representation).toBeTruthy();
    driver.expectNoErrors(`parsing ${artifact.id}`);
  });

  it.each(hubmap.map((t) => [t.id, t] as const))('%s has a stable component tree', (id, artifact) => {
    const driver = new CeeDriver(artifact.json);
    const tree = describeTree(driver.representation).join('\n') || '(no rendered children)';
    expect(tree).toMatchFileSnapshot(`./__snapshots__/hubmap/${id}.txt`);
  });

  it.each(hubmap.map((t) => [t.id, t] as const))('%s builds an instance and a report', (_id, artifact) => {
    const driver = new CeeDriver(artifact.json);
    expect(driver.metadata).toBeTruthy();
    expect(typeof driver.qualityReport.isValid).toBe('boolean');
  });
});
