/**
 * Which side decides a container's child order — and how a disagreement resolves.
 *
 * `container-reader-parity` proves that for a *well-formed* template the JSON and
 * YAML readers agree on child order. It cannot say which signal each reader
 * treats as authoritative, because in a well-formed template every signal agrees.
 * This pins the source of truth on each side by making the signals disagree:
 *
 *   - JSON names the order explicitly in `_ui.order`; the `properties` object is
 *     an (unordered) map. So the authoritative signal is `_ui.order`, and a
 *     property present in `properties` but absent from `_ui.order` is a state
 *     JSON can express. The reader resolves it in favour of `_ui.order`: the
 *     orphan is dropped, with a recorded `jtr08` comparison error.
 *   - YAML has no `_ui.order`; `children` is a sequence, so order *is* list
 *     position. Reordering the sequence reorders the form — there is no second
 *     signal to disagree with, and the mismatch state above is inexpressible.
 *
 * Both readers funnel into one ordered children list, which is why a well-formed
 * round trip is lossless: the JSON writer emits `_ui.order` from that list, the
 * YAML writer emits the sequence from it.
 */
import { describe, expect, it } from 'vitest';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { CedarReaders, CedarWriters } from 'cedar-model-typescript-library';
import { buildTemplateModel } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';

const TEXT = FIELD_KINDS.find((k) => k.key === 'text')!;

const templateWriter = CedarWriters.json().getStrict().getTemplateWriter();

const model = buildTemplateModel({
  name: 'Order',
  children: [
    { kind: TEXT, name: 'alpha' },
    { kind: TEXT, name: 'beta' },
    { kind: TEXT, name: 'gamma' },
  ],
});
const baselineJson = JSON.parse(templateWriter.getAsJsonString(model));
const baselineYaml = CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(model);

/** Re-serialize a read-back template to a plain JSON object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emitted = (template: any) => JSON.parse(templateWriter.getAsJsonString(template));

/** The child property names carried in `properties`, in `properties` key order. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const childProps = (node: any): string[] => Object.keys(node.properties).filter((k) => k.startsWith('_'));

describe('YAML: the child sequence position is authoritative', () => {
  // Reorder the YAML `children` sequence — the only order signal YAML carries —
  // and read it back. The emitted JSON `_ui.order` must follow the new sequence.
  const doc = parseYaml(baselineYaml) as { children: Array<{ key: string }> };
  const reordered = ['_gamma', '_alpha', '_beta'];
  doc.children = reordered.map((key) => doc.children.find((c) => c.key === key)!);
  const yaml = stringifyYaml(doc);

  const result = CedarReaders.yaml().getStrict().getTemplateReader().readFromString(yaml);
  const out = emitted(result.template);

  it('reordering the sequence reorders the emitted _ui.order', () => {
    expect(out._ui.order).toEqual(reordered);
  });

  it('keeps every child — reordering moves, it does not drop', () => {
    expect(childProps(out).sort()).toEqual(['_alpha', '_beta', '_gamma']);
  });
});

describe('JSON: _ui.order is authoritative over properties key order', () => {
  // Leave `properties` in its original key order but permute `_ui.order`. The
  // read order must follow `_ui.order`, not the order the properties happen to
  // sit in on the object.
  const permuted = ['_gamma', '_beta', '_alpha'];
  const json = { ...baselineJson, _ui: { ...baselineJson._ui, order: permuted } };

  const result = CedarReaders.json().getStrict().getTemplateReader().readFromString(JSON.stringify(json));
  const out = emitted(result.template);

  it('the emitted order follows _ui.order, not the properties map', () => {
    expect(out._ui.order).toEqual(permuted);
  });

  it('parses cleanly — a permutation is not a mismatch', () => {
    expect(result.parsingResult.getBlueprintComparisonErrorCount()).toBe(0);
  });
});

describe('JSON: a property missing from _ui.order is dropped, with an error', () => {
  // `_beta` stays in `properties` (and is stripped from `required`, so the only
  // discrepancy is properties-vs-order) but is removed from `_ui.order`. The
  // reader trusts `_ui.order`: `_beta` never enters the children list.
  const order = baselineJson._ui.order.filter((k: string) => k !== '_beta');
  const required = (baselineJson.required ?? []).filter((k: string) => k !== '_beta');
  const json = { ...baselineJson, _ui: { ...baselineJson._ui, order }, required };

  const result = CedarReaders.json().getStrict().getTemplateReader().readFromString(JSON.stringify(json));
  const out = emitted(result.template);

  it('drops the orphaned child from both order and properties', () => {
    expect(out._ui.order).toEqual(['_alpha', '_gamma']);
    expect(childProps(out)).not.toContain('_beta');
  });

  it('records a jtr08 "missing from order" comparison error', () => {
    const codes = result.parsingResult.getBlueprintComparisonErrors().map((e) => e.errorLocation);
    expect(codes).toContain('jtr08');
  });
});
