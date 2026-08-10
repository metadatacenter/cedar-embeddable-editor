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
import { JsonTemplateInstanceReader } from 'cedar-model-typescript-library';
import { CARDINALITIES, FIELD_KINDS, NESTINGS } from '../src/axes';
import { sweep } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { labelOf, literalOf } from '../src/values';
import { JsonSchema } from 'cedar-model-typescript-library';

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
 * `JsonSchema.rdfsLabel in node` is still true. A key-presence check silently returns
 * undefined for every IRI-valued field.
 */
const plainValue = (node: any): unknown => {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) return node.map((n) => plainValue(n));
  if (typeof node !== 'object') return node;
  if (literalOf(node) !== undefined) return literalOf(node);
  if (labelOf(node) !== undefined) return labelOf(node);
  if (node[JsonSchema.atId] !== undefined) return node[JsonSchema.atId];
  return null;
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
      // Attribute-value fields break the usual shape: the field's own array
      // holds attribute *names*, and the value lands as a key on the PARENT
      // object. See DataObjectDataValueHandler.injectAttributeValue.
      const parent = driver.handlerContext.getParentDataObjectNodeByPath(c.path);
      expect(parent, 'no parent node resolved for attribute-value field').toBeTruthy();
      expect(plainValue((parent as any)['attrKey'])).toBe(c.kind.sample);
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

describe('emitted instances are structurally sound', () => {
  /**
   * A failure here means CEE emitted JSON-LD the CEDAR model cannot parse.
   *
   * This is deliberately a separate block from the value round-trip so that a
   * systemic problem (e.g. a missing `schema:isBasedOn` on every instance)
   * shows up as one obvious cluster rather than masking the value assertions.
   * If this whole block goes red on first run, read it as a finding about
   * CEE's output contract, not as a broken harness.
   */
  it.each(CASES.map((c) => [c.label, c] as const))('%s parses with the model library', (_label, c) => {
    const driver = new CeeDriver(c.template);
    driver.setValue(c.path, c.kind);

    const result = JsonTemplateInstanceReader.getStrict().readFromString(JSON.stringify(driver.metadata));

    expect(result.instance, 'reader returned no instance').toBeTruthy();
    // Built eagerly: vitest's second argument is a message, not a thunk it calls
    // on failure. Written as one it was never invoked, so a failing case reported
    // "expected false to be true" and none of the parse errors it had collected.
    const parseErrors = result.parsingResult.getBlueprintComparisonErrors().join('\n  ');
    expect(result.parsingResult.wasSuccessful(), `parse errors:\n  ${parseErrors}`).toBe(true);
  });
});

/**
 * The envelope: present on the full tree the host page receives, absent from the
 * extract copy CEE edits against. Not data, so not part of the comparison —
 * `DataObjectUtil.deleteContext` is what keeps it off the extract side.
 */
const ENVELOPE_ONLY_ON_THE_FULL_TREE = new Set([
  JsonSchema.atContext,
  JsonSchema.atId,
  JsonSchema.atType,
  'schema:isBasedOn',
  'schema:name',
  'schema:description',
]);

describe('the two instance trees stay in agreement', () => {
  /**
   * CEE maintains `instanceExtractData` and `instanceFullData` as separate
   * trees and writes every mutation to both. There is no single source of
   * truth, so divergence is a live failure mode — and it is invisible from the
   * UI, because widgets are seeded from the extract tree while the host page
   * reads the full tree.
   */
  it.each(VALUED.map((c) => [c.label, c] as const))('%s writes to both trees', (_label, c) => {
    const driver = new CeeDriver(c.template);
    driver.setValue(c.path, c.kind);

    const stripContext = (o: unknown): unknown => {
      if (Array.isArray(o)) return o.map(stripContext);
      if (o && typeof o === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(o)) {
          // Envelope, not data: only the full tree carries it. `schema:isBasedOn`
          // names the template the instance came from and belongs with the
          // rest of the envelope the extract copy does without.
          if (ENVELOPE_ONLY_ON_THE_FULL_TREE.has(k)) continue;
          out[k] = stripContext(v);
        }
        return out;
      }
      return o;
    };

    expect(stripContext(driver.extract)).toEqual(stripContext(driver.metadata));
  });
});
