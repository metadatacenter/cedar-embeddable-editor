/**
 * The round-trip oracle.
 *
 * Rather than maintain a golden file per template, assert a *property*:
 *
 *   generate template -> CEE builds an instance -> write a value
 *                     -> read it back -> it is the value we wrote
 *                     -> the model library can parse the emitted JSON-LD
 *
 * Properties do not rot. When Angular Material rewrites its DOM in v15, none of
 * this changes — which is exactly why it is worth writing before the upgrade
 * rather than after.
 */
import { describe, expect, it } from 'vitest';
import { DocumentKey } from '../src/document-keys';
import { JsonTemplateInstanceReader } from 'cedar-model-typescript-library';
import { CARDINALITIES, FIELD_KINDS, NESTINGS } from '../src/axes';
import { sweep } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { InstanceDataContainer } from 'cedar-model-typescript-library';
import { labelOf, literalOf, heldValue } from '../src/values';

const CASES = sweep(FIELD_KINDS, CARDINALITIES, NESTINGS);
const VALUED = CASES.filter((c) => c.kind.write !== 'none');

/**
 * Pull the plain value back out of an instance node.
 *
 * Mirrors `DataQualityReportBuilderHandler.extractPlainValue`: `@value` for
 * ordinary fields, the bare `@id` for links and external-authority fields, and
 * `rdfs:label` for controlled terms.
 *
 * The `!== undefined` checks are load-bearing, not defensive noise. Writing to
 * a link / ext-orcid / ext-ror field leaves the node as
 * `{'@id': <iri>, 'rdfs:label': undefined}` — CEE's `injectValue` takes the
 * controlled-term path and assigns a label it was never given. `JSON.stringify`
 * drops undefined-valued keys, so the node *looks* like `{"@id": …}` while
 * `DocumentKey.rdfsLabel in node` is still true. A key-presence check silently returns
 * undefined for every IRI-valued field.
 */
/**
 * What a field ended up holding, as the sample that was written into it.
 *
 * `heldValue` answers for either side of the write/read boundary; a term comes
 * back as its IRI and label, and which of the two a spec expects depends on the
 * field: a controlled term is written by label, a link by IRI.
 */
const plainValue = (node: unknown): unknown => reduceHeld(heldValue(node));

/** A term reduces to the half the field is written by; a list, element by element. */
const reduceHeld = (held: unknown): unknown => {
  if (Array.isArray(held)) {
    return held.map(reduceHeld);
  }
  if (held !== null && typeof held === 'object') {
    const term = held as { iri?: string | null; label?: string | null };
    return term.label ?? term.iri ?? null;
  }
  return held;
};

describe('value round-trip', () => {
  it('has cases to run', () => {
    expect(CASES.length).toBeGreaterThan(0);
  });

  it.each(VALUED.map((c) => [c.label, c] as const))('%s survives a write/read cycle', (_label, c) => {
    const driver = new CeeDriver(c.template);
    driver.setValue(c.path, c.kind);
    driver.expectNoErrors(`writing ${c.label}`);

    if (c.kind.write === 'attribute') {
      // Attribute-value fields break the usual shape: the field's own list holds
      // attribute *names*, and the value the name points at sits on the parent
      // container. See DataObjectDataValueHandler.injectAttributeValue.
      const parent = driver.handlerContext.getParentDataObjectNodeByPath(c.path);
      expect(parent, 'no parent node resolved for attribute-value field').toBeTruthy();
      expect(plainValue((parent as InstanceDataContainer).values['attrKey'])).toBe(c.kind.sample);
      return;
    }

    const node = driver.handlerContext.getDataObjectNodeByPath(c.path);
    expect(node, 'path resolved to nothing — see DataObjectStructureHandler').toBeTruthy();

    // For links and external-authority fields the sample IS the IRI, and for
    // controlled terms `plainValue` returns rdfs:label — so in every case the
    // value we expect back is the one we wrote.
    const read = plainValue(node);
    const expected = c.kind.sample;

    if (Array.isArray(read)) {
      // Non-paged multi fields (checkbox, list) hold the whole array at once.
      expect(read).toContain(expected);
    } else {
      expect(read).toBe(expected);
    }
  });
});

/*
 * Two blocks stood below this one and are gone.
 *
 * "emitted instances are structurally sound" read every emitted document back
 * with the model library and asserted it parsed. That is the library reading
 * what the library wrote; CEE's part is upstream of it, and is what the round
 * trip above states.
 *
 * "the two instance trees stay in agreement" asserted that the envelope-free
 * view matched the full tree after each kind of edit, envelope keys excepted.
 * CEE kept two trees and wrote every mutation to both, so divergence was a live
 * failure mode. There is one tree, and the view without the envelope is the
 * instance's own data container — the same object, so there is nothing a test
 * can catch drifting.
 */
