/**
 * What CEE shows for a value, which is not the same as what a value is.
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
 * while parsing and records it in the node's type — and the library's own suite
 * is where that answer is held. What was here beside these, asserting that
 * `{JsonSchema.atId, 'rdfs:label'}` reads as a value and a container does not, tested the
 * library through a one-line delegation and is gone.
 *
 * What stays is CEE's part: which half of a term a field shows, and whether a
 * term with no label counts as filled. Neither is derivable from the node — the
 * field's own kind decides them — so neither is the library's to answer.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, ControlledTermOntologyBuilder, Iri } from 'cedar-model-typescript-library';
import type { InstanceNode } from '@cee/models/instance-node.model';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { instanceWith, linkNode, literalNode, termNode } from '../src/values';
import { JsonSchema } from 'cedar-model-typescript-library';

/**
 * An instance always names the template it is an instance of; there is no
 * valid CEDAR instance without one. Fixtures that stand in for what a host page
 * injects have to be valid instances too.
 */
const TEMPLATE_IRI = 'https://repo.metadatacenter.org/templates/fixture';
const INSTANCE_IRI = 'https://example.org/i/1';

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

describe('what the quality report reads a node as', () => {
  const reportValue = (kind: FieldKind, node: InstanceNode) => {
    const template = buildTemplate({ name: `ivn_${kind.key}`, children: [{ kind, name: 'f' }] });
    const driver = new CeeDriver(template, {
      // Only `_f` is written by hand: the node under test is supplied by the caller,
      // including shapes the library would not write.
      instance: { ...instanceWith(TEMPLATE_IRI, {}, INSTANCE_IRI), _f: node },
    });
    driver.handlerContext.buildQualityReport();
    return driver.qualityReport.valueTree._f.value;
  };

  it('reads a controlled term by its label', () => {
    expect(reportValue(CONTROLLED, termNode('https://x/1', 'One'))).toBe('One');
  });

  /**
   * The template is what settles this one. `{@id, rdfs:label}` is a term to be
   * shown by its label on a controlled field and a resource to be shown by its
   * IRI on a link, and the instance carries nothing that distinguishes them.
   */
  it('reads a link by its IRI even when a label came with it', () => {
    expect(reportValue(LINK, termNode('https://x/1', 'One'))).toBe('https://x/1');
  });

  /**
   * BEHAVIOUR CHANGE: a controlled term with no label used to read as empty —
   * the report looked up `rdfs:label`, found nothing, and returned null, so a
   * required field holding a perfectly good IRI could never be satisfied. It
   * now reads as that IRI. Nine such nodes exist across the 21 corpus
   * instances against 45 carrying labels, so this is not a hypothetical shape.
   */
  it('reads a labelless controlled term by its IRI rather than as empty', () => {
    expect(reportValue(CONTROLLED, linkNode('https://x/1'))).toBe('https://x/1');
  });

  it('reads a literal by its value', () => {
    expect(reportValue(LINK, literalNode('plain'))).toBe('plain');
  });

  it('reads an empty value as nothing', () => {
    expect(reportValue(CONTROLLED, linkNode(''))).toBeNull();
    expect(reportValue(LINK, literalNode(''))).toBeNull();
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
      instance: { ...instanceWith(TEMPLATE_IRI, {}, INSTANCE_IRI), _f: linkNode('https://x/1') },
    });
    driver.handlerContext.buildQualityReport();

    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(1);
  });
});
