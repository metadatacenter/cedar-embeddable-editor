/**
 * What the RDF downloads say, and what they refuse to say.
 *
 * CEDAR's instance JSON is JSON-LD with three conventions the processor does not
 * accept as they stand: `"@id": null` for a node awaiting its identifier, empty
 * fields written as `{}` or `{"@value": null}`, and field names a JSON-LD 1.1
 * processor reads as IRIs. Each is settled before conversion, and each has a case
 * here that would fail if it were settled by dropping data or by inventing it.
 * Past those, the processor runs in safe mode, so the corpus cases below prove that
 * nothing any of them holds is lost on the way.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import jsonld from 'jsonld';
import { Parser, Writer, type Quad } from 'n3';
import { toNQuads, toTurtle } from '@cee/util/rdf-export';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { CedarTemplate } from '@cee/models/template/cedar-template.model';
import { CeeDriver } from '../src/driver';
import { ceeSuiteCases } from '../src/corpus';

const P = 'https://schema.metadatacenter.org/properties/';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

/**
 * One statement per line, sorted, so two serializations can be compared. A blank node's label is
 * the serialization's own choice, so it reads as `_`.
 */
const term = (node: Quad['subject'] | Quad['object']): string =>
  node.termType === 'BlankNode' ? '_' : `${node.termType}:${node.value}`;
const statements = (quads: Quad[]): string[] =>
  quads.map((q) => `${term(q.subject)} ${q.predicate.value} ${term(q.object)}`).sort();
const fromNQuads = (text: string): Quad[] => new Parser({ format: 'N-Quads' }).parse(text);
const fromTurtle = (text: string): Quad[] => new Parser({ format: 'Turtle' }).parse(text);

/** Preserve blank-node relationships, graph names, literal datatypes and language tags. */
const canonical = async (quads: Quad[]): Promise<string> => {
  const writer = new Writer({ format: 'N-Quads' });
  writer.addQuads(quads);
  const nquads = await new Promise<string>((resolve, reject) =>
    writer.end((error, text) => (error ? reject(error) : resolve(text))),
  );
  // @types/jsonld predates the supported N-Quads input form.
  const canonizeNQuads = jsonld.canonize as unknown as (
    input: string,
    options: {
      inputFormat: string;
      format: string;
      canonizeOptions: { algorithm: string; maxDeepIterations: number };
    },
  ) => Promise<string>;
  return canonizeNQuads(nquads, {
    inputFormat: 'application/n-quads',
    format: 'application/n-quads',
    canonizeOptions: { algorithm: 'RDFC-1.0', maxDeepIterations: 10_000 },
  });
};

const PREFIXES = {
  xsd: XSD,
  schema: 'http://schema.org/',
  pav: 'http://purl.org/pav/',
};

describe('RDF dataset comparison', () => {
  it('ignores blank-node labels while retaining cycles', async () => {
    const a = '_:a <https://example.org/next> _:b .\n_:b <https://example.org/next> _:a .';
    const b = '_:x <https://example.org/next> _:y .\n_:y <https://example.org/next> _:x .';
    expect(await canonical(fromNQuads(a))).toEqual(await canonical(fromNQuads(b)));
  });

  it('distinguishes two separate nodes from a shared node', async () => {
    const a =
      '<https://example.org/s> <https://example.org/a> _:a .\n' +
      '<https://example.org/s> <https://example.org/b> _:b .';
    const b =
      '<https://example.org/s> <https://example.org/a> _:a .\n' +
      '<https://example.org/s> <https://example.org/b> _:a .';
    expect(await canonical(fromNQuads(a))).not.toEqual(await canonical(fromNQuads(b)));
  });

  it('retains datatypes, language tags and graph names', async () => {
    const statement = '<https://example.org/s> <https://example.org/p> ';
    const variants = [
      '"1"',
      '"1"^^<http://www.w3.org/2001/XMLSchema#int>',
      '"1"@en',
      '"1"@fr',
      '"1" <https://example.org/graph>',
    ];
    const normalized = await Promise.all(variants.map((value) => canonical(fromNQuads(statement + value + ' .'))));
    expect(new Set(normalized).size).toBe(variants.length);
  });
});

describe('an instance as RDF', () => {
  it('types literals and IRIs the way the context coerces them', async () => {
    const quads = fromNQuads(
      await toNQuads({
        '@context': {
          ...PREFIXES,
          'schema:isBasedOn': { '@type': '@id' },
          'pav:createdOn': { '@type': 'xsd:dateTime' },
          Count: P + 'count',
        },
        '@id': 'https://repo.metadatacenter.org/template-instances/1',
        'schema:isBasedOn': 'https://repo.metadatacenter.org/templates/1',
        'pav:createdOn': '2026-09-24T10:00:00-07:00',
        Count: { '@value': '3', '@type': 'xsd:int' },
      }),
    );
    const object = (predicate: string): Quad | undefined => quads.find((q) => q.predicate.value === predicate);

    expect(object('http://schema.org/isBasedOn')?.object.termType).toBe('NamedNode');
    expect(object('http://purl.org/pav/createdOn')?.object).toMatchObject({
      termType: 'Literal',
      datatype: { value: XSD + 'dateTime' },
    });
    expect(object(P + 'count')?.object).toMatchObject({ value: '3', datatype: { value: XSD + 'int' } });
  });

  it('links nested and repeated elements through nodes of their own', async () => {
    const quads = fromNQuads(
      await toNQuads({
        '@context': { ...PREFIXES, Sample: P + 'sample' },
        '@id': 'https://repo.metadatacenter.org/template-instances/1',
        Sample: [
          { '@context': { Label: P + 'label' }, '@id': null, Label: { '@value': 'first' } },
          { '@context': { Label: P + 'label' }, '@id': null, Label: { '@value': 'second' } },
        ],
      }),
    );
    const samples = quads.filter((q) => q.predicate.value === P + 'sample').map((q) => q.object);
    const labels = quads.filter((q) => q.predicate.value === P + 'label');

    expect(samples).toHaveLength(2);
    expect(samples.every((node) => node.termType === 'BlankNode')).toBe(true);
    expect(new Set(labels.map((q) => q.subject.value))).toEqual(new Set(samples.map((node) => node.value)));
    expect(labels.map((q) => q.object.value).sort()).toEqual(['first', 'second']);
  });

  it('states attribute values under their own property IRIs, without the list naming them', async () => {
    const quads = fromNQuads(
      await toNQuads({
        '@context': { ...PREFIXES, colour: P + 'colour', size: P + 'size' },
        '@id': 'https://repo.metadatacenter.org/template-instances/1',
        Attributes: ['colour', 'size'],
        colour: { '@value': 'blue' },
        size: { '@value': 'large' },
      }),
    );

    expect(statements(quads)).toEqual([
      `NamedNode:https://repo.metadatacenter.org/template-instances/1 ${P}colour Literal:blue`,
      `NamedNode:https://repo.metadatacenter.org/template-instances/1 ${P}size Literal:large`,
    ]);
  });

  it('states nothing for an empty field, and makes a node awaiting its identifier a blank node', async () => {
    const quads = fromNQuads(
      await toNQuads({
        '@context': {
          ...PREFIXES,
          Title: P + 'title',
          Link: { '@id': P + 'link', '@type': '@id' },
          Notes: P + 'notes',
        },
        '@id': null,
        Title: { '@value': null },
        Link: {},
        Notes: [{ '@value': null }, { '@value': 'kept' }],
      }),
    );

    expect(quads).toHaveLength(1);
    expect(quads[0].subject.termType).toBe('BlankNode');
    expect(quads[0].predicate.value).toBe(P + 'notes');
    expect(quads[0].object.value).toBe('kept');
  });

  it('keeps a field whose name JSON-LD would read as an IRI under the IRI its context gives', async () => {
    const quads = fromNQuads(
      await toNQuads({
        '@context': {
          ...PREFIXES,
          'schema:name': { '@type': 'xsd:string' },
          'Date (month/year)': P + 'date',
          'Time: start': P + 'start',
        },
        '@id': 'https://repo.metadatacenter.org/template-instances/1',
        'schema:name': 'a name',
        'Date (month/year)': { '@value': '2026-09', '@type': 'xsd:gYearMonth' },
        'Time: start': { '@value': '10:00:00', '@type': 'xsd:time' },
      }),
    );

    expect(quads.map((q) => q.predicate.value).sort()).toEqual(['http://schema.org/name', P + 'date', P + 'start']);
    expect(quads.some((q) => q.predicate.value.includes('cee-term'))).toBe(false);
  });

  it('refuses a remote context rather than fetching it', async () => {
    await expect(
      toNQuads({
        '@context': 'https://example.org/context.jsonld',
        '@id': 'https://repo.metadatacenter.org/template-instances/1',
      }),
    ).rejects.toThrow();
  });

  it('refuses a value the context gives no IRI, rather than dropping it', async () => {
    await expect(
      toNQuads({
        '@context': { ...PREFIXES },
        '@id': 'https://repo.metadatacenter.org/template-instances/1',
        Unmapped: { '@value': 'lost' },
      }),
    ).rejects.toThrow('"Unmapped" has no property IRI yet');
  });

  it('waits for the save before stating an attribute the user has just named', async () => {
    await expect(
      toNQuads({
        '@context': { ...PREFIXES },
        '@id': null,
        _attribute: ['colour'],
        colour: { '@value': 'blue' },
      }),
    ).rejects.toThrow('"colour" has no property IRI yet, so RDF cannot state its value.');
  });

  it('writes the Turtle with the prefixes the instance declares', async () => {
    const turtle = await toTurtle({
      '@context': { ...PREFIXES, 'schema:isBasedOn': { '@type': '@id' } },
      '@id': 'https://repo.metadatacenter.org/template-instances/1',
      'schema:isBasedOn': 'https://repo.metadatacenter.org/templates/1',
    });

    expect(turtle).toContain('@prefix schema: <http://schema.org/>.');
    expect(turtle).toContain('schema:isBasedOn <https://repo.metadatacenter.org/templates/1>');
  });
});

describe('every corpus instance', () => {
  const paired = ceeSuiteCases().filter((c) => c.template !== null && c.instance !== null);

  const instanceFor = (id: string) => {
    const c = paired.find((candidate) => candidate.id === id)!;
    const driver = new CeeDriver(c.template as object, { instance: c.instance as object });
    const representation = driver.dataContext.templateRepresentation;
    const template = representation instanceof CedarTemplate ? representation.parsed : null;
    return InstanceSerializer.toJson(driver.dataContext.instanceFullData, template);
  };

  const exported: Array<{ id: string; source: ReturnType<typeof instanceFor> }> = [];
  afterAll(() => {
    // Opt-in evidence for the isolated Java/CEE processor comparison. No production data here.
    const output = process.env.CEDAR_RDF_CORPUS_OUTPUT;
    if (output) writeFileSync(output, JSON.stringify(exported, null, 2) + '\n');
  });

  it.each(paired.map((c) => c.id))('case %s converts, and its Turtle states exactly its N-Quads', async (id) => {
    const instance = instanceFor(id);
    exported.push({ id, source: instance });
    const nquads = await canonical(fromNQuads(await toNQuads(instance)));
    const turtle = await canonical(fromTurtle(await toTurtle(instance)));

    expect(nquads.length).toBeGreaterThan(0);
    expect(turtle).toEqual(nquads);
  });
});

// Shared authored contract; expected statements are independent of either implementation.
const rdfCases = JSON.parse(readFileSync(new URL('../fixtures/rdf-corpus.json', import.meta.url), 'utf8')) as {
  id: string;
  source: Parameters<typeof toNQuads>[0];
  template?: Parameters<typeof toNQuads>[1];
  expect: string;
  expectedNquads: string;
}[];
describe('independent RDF contract corpus', () => {
  for (const fixture of rdfCases)
    it(fixture.id, async () => {
      const before = JSON.stringify(fixture.source);
      if (fixture.expect === 'reject') {
        await expect(toNQuads(fixture.source, fixture.template)).rejects.toThrow();
        await expect(toTurtle(fixture.source, fixture.template)).rejects.toThrow();
      } else {
        const expected = await canonical(fromNQuads(fixture.expectedNquads));
        expect(await canonical(fromNQuads(await toNQuads(fixture.source, fixture.template)))).toEqual(expected);
        if (fixture.id === 'named-graph')
          await expect(toTurtle(fixture.source, fixture.template)).rejects.toThrow('named graphs');
        else expect(await canonical(fromTurtle(await toTurtle(fixture.source, fixture.template)))).toEqual(expected);
      }
      expect(JSON.stringify(fixture.source)).toEqual(before);
    });
});
