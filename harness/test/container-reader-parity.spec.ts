/**
 * The JSON and YAML readers agree on a container's structure, not just its fields.
 *
 * `format-independence-generative.spec.ts` proves the two serializations render
 * and fill the same in CEE. This checks the layer underneath and around a value:
 * a *container's* own properties — the order of its children, the per-property
 * labels and descriptions, a template's header and footer, an element's
 * multiple-instance bounds. CEE's rendered tree does not surface all of these,
 * so a reader that dropped `_ui.order` or a property label could pass the
 * format-independence check and still corrupt a template on the way through YAML.
 *
 * Compared at the library level: one model, written down both ways, read back
 * through each reader, and re-serialized to JSON. `title`/`description` are the
 * one known, deliberate difference — YAML has no place for them and both
 * libraries reconstruct them from the name — so they are excluded here and
 * pinned on their own in the library's `YamlTitleDerivation` spec.
 */
import { describe, expect, it } from 'vitest';
import { CedarReaders, CedarWriters } from 'cedar-model-typescript-library';
import { buildTemplateModel } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';

const TEXT = FIELD_KINDS.find((k) => k.key === 'text')!;
const NUM = FIELD_KINDS.find((k) => k.key === 'numeric')!;

const templateWriter = CedarWriters.json().getStrict().getTemplateWriter();

/** The template as a JSON object, minus the derived title/description handled elsewhere. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withoutDerived = (value: any): any => {
  if (Array.isArray(value)) return value.map(withoutDerived);
  if (value && typeof value === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'title' || k === 'description') continue;
      out[k] = withoutDerived(v);
    }
    return out;
  }
  return value;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asNode = (template: any) => withoutDerived(JSON.parse(templateWriter.getAsJsonString(template)));

describe('a container reads back the same from JSON and from YAML', () => {
  // Three ordered fields (which exercise _ui.order and the per-property labels
  // and descriptions the generative builder attaches) and a multiple-instance
  // element with two nested children (cardinality bounds and nested order).
  const model = buildTemplateModel({
    name: 'Container',
    children: [
      { kind: TEXT, name: 'alpha' },
      { kind: NUM, name: 'beta' },
      { kind: TEXT, name: 'gamma' },
    ],
    elements: [
      {
        name: 'addr',
        cardinality: 'multi',
        minItems: 1,
        maxItems: 4,
        children: [
          { kind: TEXT, name: 'city' },
          { kind: TEXT, name: 'zip' },
        ],
      },
    ],
  });

  const yaml = CedarWriters.yaml().getStrict().getTemplateWriter().getAsYamlString(model);
  const json = templateWriter.getAsJsonString(model);
  const fromJson = CedarReaders.json().getStrict().getTemplateReader().readFromString(json).template;
  const fromYaml = CedarReaders.yaml().getStrict().getTemplateReader().readFromString(yaml).template;

  it('agrees on the whole template', () => {
    expect(asNode(fromYaml)).toEqual(asNode(fromJson));
  });

  it('agrees on child order and per-property labels and descriptions', () => {
    expect(asNode(fromYaml)._ui).toEqual(asNode(fromJson)._ui);
  });

  it('agrees on the required list', () => {
    expect(asNode(fromYaml).required).toEqual(asNode(fromJson).required);
  });

  it('agrees on the nested element, its cardinality and its children', () => {
    expect(asNode(fromYaml).properties._addr).toEqual(asNode(fromJson).properties._addr);
  });
});
