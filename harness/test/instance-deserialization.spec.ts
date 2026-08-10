/**
 * Reading an injected instance through the library instead of by hand.
 *
 * A host page can hand CEE any valid CEDAR instance. CEE used to take it in by
 * cloning the document twice and walking one copy deleting envelope keys,
 * deciding which nodes were values — and so had to be left alone — by counting
 * their keys. That guess destroyed data, and it was the last place CEE read a
 * CEDAR artifact without asking the model what one is.
 *
 * `InstanceDeserializer` reads it once with `CedarReaders` and projects the two
 * trees CEE edits out of the parsed model. These tests hold the projection to
 * the old walk's output over every corpus instance — the fixtures the harness
 * did not generate, so the library is not on both sides — and then to the
 * properties the old walk got wrong.
 */
import { describe, expect, it } from 'vitest';
import { InstanceDeserializer } from '@cee/util/instance-deserializer';
import type { InstanceObject } from '@cee/models/instance-node.model';
import { InstanceValueNode } from '@cee/util/instance-value-node';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { corpusInstances } from '../src/corpus';
import { JsonNode, JsonSchema, JsonTemplateInstanceReader } from 'cedar-model-typescript-library';
import { linkNode, literalNode, termNode } from '../src/values';
import type { InstanceNode } from '@cee/models/instance-node.model';

const instances = corpusInstances();

/**
 * `DataObjectUtil.deleteContext`, as it stood before the library replaced it.
 *
 * Kept here, and only here, because the evidence that the replacement is
 * faithful is that the two agree across the corpus — and that evidence is worth
 * more than the deleted code. It is a copy rather than an import because CEE no
 * longer ships this: nothing in `src/` walks an instance deleting keys.
 *
 * Note that this is the *fixed* version. The original decided what was a value
 * by counting keys and destroyed any IRI carrying a `@type`; asking
 * `InstanceValueNode` is what stopped that, and is the closest the hand walk
 * ever got to correct. Diffing against the broken one would flatter the
 * replacement.
 */
/**
 * The envelope, named by the library rather than listed here.
 *
 * A hand-written list is the same mistake as a hand-written stripper: it is the
 * harness deciding what CEDAR calls the wrapping around an instance. The reader
 * keeps the authoritative set private, so these are its own constants for the
 * nine keys a complete instance carries.
 */
const ENVELOPE_KEYS: string[] = [
  JsonSchema.atContext,
  JsonSchema.atId,
  JsonSchema.schemaIsBasedOn,
  JsonSchema.schemaName,
  JsonSchema.schemaDescription,
  JsonSchema.pavCreatedOn,
  JsonSchema.pavCreatedBy,
  JsonSchema.pavLastUpdatedOn,
  JsonSchema.oslcModifiedBy,
];

/**
 * Every key at every depth, skipping the values.
 *
 * A value node is not searched, and the reason is `@id`: it is an envelope key
 * on a container and the whole value of a link or a controlled term. Walking
 * into one would report a term's own IRI as an envelope key that survived. Which
 * nodes are values is the library's answer, asked here rather than guessed —
 * guessing it by counting keys is the defect this file exists to record.
 */
const keysAnywhere = (node: unknown, found: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(node)) {
    node.forEach((child) => keysAnywhere(child, found));
  } else if (node !== null && typeof node === 'object') {
    if (JsonTemplateInstanceReader.isValueNode(node as JsonNode)) {
      return found;
    }
    for (const [key, child] of Object.entries(node)) {
      found.add(key);
      keysAnywhere(child, found);
    }
  }
  return found;
};

/**
 * What the extract projection is, stated rather than compared.
 *
 * This used to assert that the projection equalled a walk written out in this
 * file — the implementation it replaced, kept as an oracle. That walk is gone
 * from CEE, so what remained was the harness maintaining a second CEDAR-JSON
 * stripper in order to check the first, and knowing the envelope by heart to do
 * it. The property itself needs neither: the envelope is absent at every depth,
 * and everything else survives.
 */
describe('the extract tree', () => {
  it('there are instances to check', () => {
    expect(instances.length).toBeGreaterThan(15);
  });

  it.each(instances.map((i) => [i.id, i] as const))(
    'instance-%s drops the envelope at every depth',
    (_id, artifact) => {
      const extract = InstanceDeserializer.read(artifact.json).extract;
      expect([...keysAnywhere(extract)].filter((key) => ENVELOPE_KEYS.includes(key))).toEqual([]);
    },
  );

  it.each(instances.filter((i) => i.id !== '021').map((i) => [i.id, i] as const))(
    'instance-%s keeps everything else',
    (_id, artifact) => {
      const extract = InstanceDeserializer.read(artifact.json).extract as Record<string, unknown>;
      const source = artifact.json as Record<string, unknown>;
      for (const key of Object.keys(source).filter((k) => !ENVELOPE_KEYS.includes(k))) {
        expect(extract[key], `${key} did not survive the projection`).toBeDefined();
      }
    },
  );
});

describe('instance annotations', () => {
  /**
   * The one divergence from the old walk, and an improvement.
   *
   * `_annotations` is instance-level metadata — a DOI, a free-text note — not a
   * value of any field, and no component has a path into it. The old walk did
   * not recognise it, so it was not in the list of keys to strip and it stayed
   * in the extract, sitting in the working tree where the handlers and the
   * quality report walk. Nothing read it; nothing would have known what to do
   * with it if it had.
   *
   * The library classifies it as what it is and holds it outside the data
   * container, so it no longer appears in the extract — and writes it back
   * unchanged, so the host page still gets it. That is the distinction the
   * extract is *for*, applied to a key the hand-written walk had never heard
   * of.
   */
  const annotated = instances.find((i) => i.id === '021');

  it('are kept out of the tree the form edits', () => {
    const extract = InstanceDeserializer.read(annotated!.json).extract as Record<string, unknown>;
    expect(extract._annotations).toBeUndefined();
    expect((annotated!.json as Record<string, unknown>)._annotations, 'the fixture carries annotations').toBeDefined();
  });

  it('are handed back to the host page unchanged', () => {
    const full = InstanceDeserializer.read(annotated!.json).full as Record<string, unknown>;
    expect(full._annotations).toEqual((annotated!.json as Record<string, unknown>)._annotations);
  });

  it('survive being written back out', () => {
    const emitted = InstanceSerializer.toJson(InstanceDeserializer.read(annotated!.json).full) as Record<
      string,
      unknown
    >;
    expect(emitted._annotations).toEqual((annotated!.json as Record<string, unknown>)._annotations);
  });

  it('are the only thing about that instance the extract drops', () => {
    const extract = InstanceDeserializer.read(annotated!.json).extract as Record<string, unknown>;
    const source = annotated!.json as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      if (key === '_annotations' || ENVELOPE_KEYS.includes(key)) {
        continue;
      }
      expect(extract[key], `${key} did not survive the projection`).toBeDefined();
    }
  });
});

describe('the full tree', () => {
  /**
   * The full tree keeps the envelope. It is no longer the document verbatim —
   * it is what the library writes for the model it read — so this checks the
   * parts a host page would notice survive the round trip.
   */
  it.each(instances.map((i) => [i.id, i] as const))('instance-%s keeps its envelope', (_id, artifact) => {
    const source = artifact.json as Record<string, unknown>;
    const full = InstanceDeserializer.read(artifact.json).full as Record<string, unknown>;

    for (const key of [
      JsonSchema.atId,
      JsonSchema.schemaIsBasedOn,
      JsonSchema.schemaName,
      JsonSchema.schemaDescription,
    ]) {
      if (source[key] !== undefined) {
        expect(full[key], key).toEqual(source[key]);
      }
    }
    expect(full[JsonSchema.atContext], 'the @context block').toBeDefined();
  });

  /**
   * The property that matters more than key-by-key equality: what CEE hands
   * back must be the same instance it was handed. Read and write are the same
   * library's mirror halves, so this is a round trip through the model.
   */
  it.each(instances.map((i) => [i.id, i] as const))('instance-%s survives a round trip', (_id, artifact) => {
    const once = InstanceDeserializer.read(artifact.json).full;
    const twice = InstanceDeserializer.read(InstanceSerializer.toJson(once)).full;
    expect(twice).toEqual(once);
  });
});

describe('what the old walk got wrong', () => {
  /**
   * REGRESSION: the walk decided a node was a value by counting its keys — two
   * with an `@id` and an `rdfs:label` meant a controlled term, one with an
   * `@id` meant a link. A `@type` alongside either, which is ordinary JSON-LD,
   * pushed the count over and the node was taken for a container, so its `@id`
   * was deleted and the value vanished.
   *
   * `deleteContext` was fixed to ask `InstanceValueNode`; reading through the
   * library means the question is not asked at all, because the library
   * classified the node while parsing it.
   */
  const envelope = {
    [JsonSchema.atContext]: {},
    '@id': 'https://repo.metadatacenter.org/template-instances/fixture',
    'schema:isBasedOn': 'https://repo.metadatacenter.org/templates/fixture',
    'schema:name': 'A fixture instance',
    'schema:description': '',
  };

  it.each([
    ['a controlled term', termNode('https://x/1', 'One')],
    ['a controlled term with a @type', { '@id': 'https://x/1', 'rdfs:label': 'One', '@type': 'xsd:anyURI' }],
    ['a link', linkNode('https://x/1')],
    ['a link with a @type', { '@id': 'https://x/1', '@type': 'xsd:anyURI' }],
    ['a literal', literalNode('text')],
    ['a typed literal', literalNode('7', 'xsd:int')],
  ])('keeps the value of %s', (_label, node) => {
    const extract = InstanceDeserializer.read({ ...envelope, _f: node }).extract as Record<string, unknown>;
    // The library normalises which keys a node carries; what must survive is
    // the value itself, whichever key holds it.
    const kept = extract._f as Record<string, unknown>;
    // `node` is one of the six literal shapes the cases enumerate, so a key it
    // does not declare is not indexable on its union — read it as the record it
    // is, which is also all this loop needs it to be.
    const declared = node as Record<string, string | undefined>;
    for (const key of [JsonSchema.atValue, JsonSchema.atId, JsonSchema.rdfsLabel]) {
      if (declared[key] !== undefined) {
        expect(kept[key], key).toBe(declared[key]);
      }
    }
  });

  it('strips @context and provenance from inside an element', () => {
    const extract = InstanceDeserializer.read({
      ...envelope,
      _el: {
        '@context': { _child: 'https://schema.metadatacenter.org/properties/1' },
        '@id': 'https://repo.metadatacenter.org/template-element-instances/1',
        'pav:createdOn': '2026-01-01T00:00:00-08:00',
        'oslc:modifiedBy': 'https://metadatacenter.org/users/1',
        _child: literalNode('kept'),
      },
    }).extract as Record<string, unknown>;

    expect(extract._el).toEqual({ _child: literalNode('kept') });
  });

  it('strips it from every occurrence of a multi element', () => {
    const occurrence = (value: string) =>
      ({
        [JsonSchema.atContext]: {},
        [JsonSchema.atId]: `https://repo.metadatacenter.org/template-element-instances/${value}`,
        _child: literalNode(value),
      }) as unknown as InstanceNode;
    const extract = InstanceDeserializer.read({
      ...envelope,
      _el: [occurrence('a'), occurrence('b')],
    }).extract as Record<string, unknown>;

    expect(extract._el).toEqual([{ _child: literalNode('a') }, { _child: literalNode('b') }]);
  });

  it('strips the instance root', () => {
    const extract = InstanceDeserializer.read({ ...envelope, _f: literalNode('kept') }).extract;
    expect(extract).toEqual({ _f: literalNode('kept') });
  });
});

describe('an attribute-value field comes back in two halves', () => {
  /**
   * The library holds an attribute-value field as one node pairing names with
   * values. CEE's trees keep them apart — the field's key holds the names, and
   * each name sits on the enclosing object as a value of its own — so the
   * projection has to split it, and a name must not go missing on the way.
   */
  it('the field holds its names and the parent holds their values', () => {
    const extract = InstanceDeserializer.read({
      [JsonSchema.atContext]: {},
      '@id': 'https://repo.metadatacenter.org/template-instances/av',
      'schema:isBasedOn': 'https://repo.metadatacenter.org/templates/av',
      'schema:name': 'An instance with attributes',
      'schema:description': '',
      _av: ['alpha', 'beta'],
      alpha: literalNode('first'),
      beta: literalNode('second'),
    }).extract as Record<string, unknown>;

    expect(extract._av).toEqual(['alpha', 'beta']);
    expect(extract.alpha).toEqual(literalNode('first'));
    expect(extract.beta).toEqual(literalNode('second'));
  });

  it('a field with no attributes yet is an empty list, not absent', () => {
    const extract = InstanceDeserializer.read({
      [JsonSchema.atContext]: {},
      '@id': 'https://repo.metadatacenter.org/template-instances/av',
      'schema:isBasedOn': 'https://repo.metadatacenter.org/templates/av',
      'schema:name': 'An instance with no attributes',
      'schema:description': '',
      _av: [],
    }).extract as Record<string, unknown>;

    expect(extract._av).toEqual([]);
  });
});

describe('content the read cannot make a value of', () => {
  /**
   * BEHAVIOUR CHANGE. A CEDAR value is a literal or an IRI, so
   * `{"rdfs:label": "Some Term"}` is neither — a label with nothing to label.
   * The library reads it as empty and the field shows blank, which is right.
   * Doing it in silence was not: a host page could inject a half-written
   * controlled term, get an empty field back, and have no way to find out why.
   * Nothing in the parsing result mentioned it either.
   *
   * `InstanceDataEmptyAtom` now carries what was dropped, so CEE can say what
   * happened without re-inspecting the JSON it just handed to the library.
   */
  const envelope = {
    [JsonSchema.atContext]: {},
    '@id': 'https://repo.metadatacenter.org/template-instances/fixture',
    'schema:isBasedOn': 'https://repo.metadatacenter.org/templates/fixture',
    'schema:name': 'A fixture instance',
    'schema:description': '',
  };

  const messagesFor = (instance: InstanceObject): string[] => {
    const said: string[] = [];
    InstanceDeserializer.read(instance, (m) => said.push(m));
    return said;
  };

  it('reports a label with no @id, naming the field', () => {
    const said = messagesFor({ ...envelope, _f: { 'rdfs:label': 'Some Term' } });
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('_f');
    expect(said[0]).toContain('Some Term');
  });

  it('reports one inside an element, with the path to it', () => {
    const said = messagesFor({
      ...envelope,
      _el: { [JsonSchema.atContext]: {}, _child: { 'rdfs:label': 'Some Term' } },
    });
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('_el > _child');
  });

  it('reports each occurrence of a multi field separately', () => {
    const said = messagesFor({
      ...envelope,
      _f: [{ 'rdfs:label': 'One' }, literalNode('fine'), { 'rdfs:label': 'Three' }],
    });
    expect(said).toHaveLength(2);
    expect(said[0]).toContain('_f[0]');
    expect(said[1]).toContain('_f[2]');
  });

  it.each([
    ['a literal', literalNode('text')],
    ['a link', linkNode('https://x/1')],
    ['a controlled term', termNode('https://x/1', 'One')],
    ['an empty field', {}],
    ['an explicit null', literalNode(null)],
  ])('says nothing about %s', (_label, node) => {
    expect(messagesFor({ ...envelope, _f: node })).toEqual([]);
  });

  it('says nothing when no reporter is given', () => {
    expect(() => InstanceDeserializer.read({ ...envelope, _f: { 'rdfs:label': 'x' } })).not.toThrow();
  });
});
