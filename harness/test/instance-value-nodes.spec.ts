/**
 * What counts as a value, and what it holds.
 *
 * Every instance node is either a field's value or an element, and CEE asked
 * that question in three places with three different answers: the quality
 * report sniffed `@value`, then `@id`, then `rdfs:label`; the validator checked
 * `@id` and `rdfs:label` independently; and `DataObjectUtil.deleteContext`
 * matched on exact key counts. They agree on the two shapes CEE writes itself
 * and diverge on everything else — which matters, because a host page can
 * inject any valid CEDAR instance, not only one CEE produced.
 *
 * The question now has one answer, from the model library, which decides it
 * while parsing and records it in the node's type. These tests pin the two
 * places where the answer changed.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, ControlledTermOntologyBuilder, Iri } from 'cedar-model-typescript-library';
import { DataObjectUtil } from '@cee/util/data-object-util';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const CONTROLLED: FieldKind = {
  key: 'ct',
  inputType: 'controlled',
  make: () => CedarBuilders.controlledTermFieldBuilder(),
  isStatic: false,
  write: 'controlled',
  sample: 'Term',
  configure: (b: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b as any).addOntology(
      new ControlledTermOntologyBuilder()
        .withAcronym('MESH')
        .withName('Medical Subject Headings')
        .withUri(new Iri('https://data.bioontology.org/ontologies/MESH'))
        .build(),
    ),
};

const LINK: FieldKind = {
  key: 'link',
  inputType: 'link',
  make: () => CedarBuilders.linkFieldBuilder(),
  isStatic: false,
  write: 'value',
  sample: 'https://example.org/resource',
};

describe('stripping @context without stripping values', () => {
  /**
   * REGRESSION: `deleteContext` runs over the instance a host page injects, to
   * make CEE's extract copy. It decided what to leave alone by counting keys —
   * two keys with an `@id` and an `rdfs:label` meant a controlled term, one key
   * with an `@id` meant a link, anything else was a container to be stripped.
   *
   * A controlled term or a link that also carries a `@type` has three keys, or
   * two of the wrong kind, and so had its `@id` deleted. `@type: xsd:anyURI` on
   * an IRI is ordinary JSON-LD. The field then showed empty, and saving wrote
   * the loss back.
   */
  const strip = (node: object) => {
    const wrapper = { _f: JSON.parse(JSON.stringify(node)) };
    DataObjectUtil.deleteContext(wrapper);
    return wrapper._f;
  };

  it.each([
    ['a controlled term', { '@id': 'https://x/1', 'rdfs:label': 'One' }],
    ['a controlled term with a @type', { '@id': 'https://x/1', 'rdfs:label': 'One', '@type': 'xsd:anyURI' }],
    ['a controlled term with a notation', { '@id': 'https://x/1', 'rdfs:label': 'One', 'skos:notation': 'N1' }],
    ['a link', { '@id': 'https://x/1' }],
    ['a link with a @type', { '@id': 'https://x/1', '@type': 'xsd:anyURI' }],
    ['a literal', { '@value': 'text' }],
    ['a typed literal', { '@value': '7', '@type': 'xsd:int' }],
  ])('keeps %s intact', (_label, node) => {
    expect(strip(node)).toEqual(node);
  });

  it('still strips @context and provenance from an element', () => {
    const element = {
      '@context': { _child: 'https://schema.metadatacenter.org/properties/1' },
      '@id': 'https://repo.metadatacenter.org/template-element-instances/1',
      'pav:createdOn': '2026-01-01T00:00:00-08:00',
      _child: { '@value': 'kept' },
    };
    expect(strip(element)).toEqual({ _child: { '@value': 'kept' } });
  });

  it('strips the instance root', () => {
    const instance = {
      '@context': {},
      '@id': 'https://repo.metadatacenter.org/template-instances/1',
      'schema:name': 'An instance',
      'schema:isBasedOn': 'https://repo.metadatacenter.org/templates/1',
      _f: { '@value': 'kept' },
    };
    const copy = JSON.parse(JSON.stringify(instance));
    DataObjectUtil.deleteContext(copy);
    expect(copy).toEqual({ _f: { '@value': 'kept' } });
  });
});

describe('what the quality report reads a node as', () => {
  const reportValue = (kind: FieldKind, node: unknown) => {
    const template = buildTemplate({ name: `ivn_${kind.key}`, children: [{ kind, name: 'f' }] });
    const driver = new CeeDriver(template, {
      instance: { '@context': {}, '@id': 'https://example.org/i/1', _f: node },
    });
    driver.handlerContext.buildQualityReport();
    return driver.qualityReport.valueTree._f.value;
  };

  it('reads a controlled term by its label', () => {
    expect(reportValue(CONTROLLED, { '@id': 'https://x/1', 'rdfs:label': 'One' })).toBe('One');
  });

  /**
   * The template is what settles this one. `{@id, rdfs:label}` is a term to be
   * shown by its label on a controlled field and a resource to be shown by its
   * IRI on a link, and the instance carries nothing that distinguishes them.
   */
  it('reads a link by its IRI even when a label came with it', () => {
    expect(reportValue(LINK, { '@id': 'https://x/1', 'rdfs:label': 'One' })).toBe('https://x/1');
  });

  /**
   * BEHAVIOUR CHANGE: a controlled term with no label used to read as empty —
   * the report looked up `rdfs:label`, found nothing, and returned null, so a
   * required field holding a perfectly good IRI could never be satisfied. It
   * now reads as that IRI. Nine such nodes exist across the 21 corpus
   * instances against 45 carrying labels, so this is not a hypothetical shape.
   */
  it('reads a labelless controlled term by its IRI rather than as empty', () => {
    expect(reportValue(CONTROLLED, { '@id': 'https://x/1' })).toBe('https://x/1');
  });

  it('reads a literal by its value', () => {
    expect(reportValue(LINK, { '@value': 'plain' })).toBe('plain');
  });

  it('reads an empty value as nothing', () => {
    expect(reportValue(CONTROLLED, { '@id': '' })).toBeNull();
    expect(reportValue(LINK, { '@value': '' })).toBeNull();
  });
});

describe('a labelless controlled term satisfies a requirement', () => {
  /**
   * The consequence of the change above, at the level someone would notice:
   * the instance is reported valid instead of permanently invalid.
   */
  it('counts as filled', () => {
    const template = buildTemplate({
      name: 'ivn_req',
      children: [{ kind: CONTROLLED, name: 'f', required: true }],
    });
    const driver = new CeeDriver(template, {
      instance: { '@context': {}, '@id': 'https://example.org/i/1', _f: { '@id': 'https://x/1' } },
    });
    driver.handlerContext.buildQualityReport();

    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(1);
  });
});
