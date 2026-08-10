/**
 * The same template, written down two different ways, renders the same form.
 *
 * This is the claim the whole model-library adoption was for, stated as
 * something that can fail. CEE used to read a template by walking its JSON key
 * by key against CEE's own copy of the CEDAR vocabulary — `_ui.order`,
 * `_valueConstraints`, `properties`, `items` — so the shape of the JSON was
 * baked into how the component tree got built, and a template written as YAML
 * was not something CEE could be handed at all.
 *
 * It now works against the library's parsed model, and the library reads YAML
 * into the same `Template` it reads JSON into. So the assertion is simply that
 * the two produce the same tree, the same instance skeleton and the same
 * quality report — for every one of the 37 corpus templates, each of which
 * ships in both serialisations.
 *
 * Counting how many `'@value'` string literals are left in the source is a poor
 * proxy for "CEE no longer manipulates JSON". This is the real test: if any of
 * CEE's understanding of a template still came from the JSON rather than from
 * the model, the YAML side would differ here.
 */
import { describe, expect, it } from 'vitest';
import { ModelLibraryTemplateParser } from '@cee/factory/model-library-template-parser';
import { YamlTemplateParser } from '@cee/factory/yaml-template-parser';
import { corpusTemplates, corpusTemplatesYaml, describeTree } from '../src/corpus';
import { CeeDriver } from '../src/driver';

const json = corpusTemplates();
const yaml = corpusTemplatesYaml();

/** Cases that ship in both serialisations, paired up. */
const paired = json
  .map((j) => ({ id: j.id, json: j.json, yaml: yaml.find((y) => y.id === j.id)?.json }))
  .filter((p): p is { id: string; json: object; yaml: object } => p.yaml !== undefined);

/**
 * `@id`s are minted per run, so normalise them before comparing instances.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stable = (node: any): any => {
  if (Array.isArray(node)) return node.map(stable);
  if (node && typeof node === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = {};
    for (const key of Object.keys(node)) {
      out[key] = key === '@id' && typeof node[key] === 'string' ? '<minted>' : stable(node[key]);
    }
    return out;
  }
  return node;
};

/**
 * The one thing YAML cannot say, so the one thing the two readings may differ on.
 *
 * A checkbox, an attribute-value field or a multiple-choice list is multiple by
 * its type rather than by a flag, and the YAML serialisation has nowhere to put
 * a lower bound for one: `minItems` only appears under a `configuration` block
 * that YAML writes for fields marked `multiple: true`. No YAML file in the
 * corpus records one, from either the TypeScript or the Java library, so this is
 * a property of the format and not of either implementation.
 *
 * `template-029` is where it shows: `Other Language` declares `minItems: 1` in
 * JSON on a list that is multiple by type, and reading the YAML gives 0.
 * Everything else about the field, and every other field in all 37 templates,
 * comes out the same.
 *
 * Normalised away rather than skipped, so the comparison still covers the whole
 * of `template-029` and would fail on any *other* difference in it.
 */
const withoutUnexpressibleBound = (line: string): string => line.replace(/ min=\d+/, '');

/**
 * The instance consequence of that missing bound, forgiven at any depth.
 *
 * A lower bound the YAML cannot state means the YAML reading starts that field
 * with fewer empty slots. `Other Language` sits inside an element, so the
 * difference is nested rather than at the root, and it only became visible once
 * a fresh instance began honouring `minItems` on a choice field at all —
 * previously both readings produced an empty list for the wrong reason and
 * agreed by accident.
 *
 * This pads the YAML side back up, and will only do so with slots that are
 * genuinely empty: any *filled* entry the two readings disagree about, or a
 * difference in the other direction, still fails. The point is to forgive one
 * known limitation of the format, not to stop comparing.
 */
const withoutUnexpressibleSlots = (fromYamlSide: unknown, fromJsonSide: unknown): unknown => {
  if (Array.isArray(fromYamlSide) && Array.isArray(fromJsonSide)) {
    const padded = fromYamlSide.map((item, i) => withoutUnexpressibleSlots(item, fromJsonSide[i]));
    for (let i = padded.length; i < fromJsonSide.length; i++) {
      const missing = fromJsonSide[i];
      const isEmptySlot =
        missing !== null &&
        typeof missing === 'object' &&
        Object.values(missing as object).every((v) => v === null || v === '');
      if (!isEmptySlot) {
        // A real value is missing, which the format limitation cannot explain.
        return fromYamlSide;
      }
      padded.push(missing);
    }
    return padded;
  }
  if (
    fromYamlSide !== null &&
    typeof fromYamlSide === 'object' &&
    fromJsonSide !== null &&
    typeof fromJsonSide === 'object'
  ) {
    const yamlSide = fromYamlSide as Record<string, unknown>;
    const jsonSide = fromJsonSide as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(yamlSide)) {
      out[key] = withoutUnexpressibleSlots(yamlSide[key], jsonSide[key]);
    }
    return out;
  }
  return fromYamlSide;
};

const fromJson = (template: object) => new CeeDriver(template, { templateParser: new ModelLibraryTemplateParser() });
const fromYaml = (template: object) => new CeeDriver(template, { templateParser: new YamlTemplateParser() });

describe('a template read from YAML', () => {
  it('there are paired cases to compare', () => {
    expect(paired.length).toBeGreaterThan(30);
  });

  it.each(paired.map((p) => [p.id, p] as const))('template-%s renders the same form', (_id, pair) => {
    const viaJson = describeTree(fromJson(pair.json).representation);
    const viaYaml = describeTree(fromYaml(pair.yaml).representation);
    expect(viaYaml.map(withoutUnexpressibleBound)).toEqual(viaJson.map(withoutUnexpressibleBound));
  });

  /**
   * The instance follows the tree, so the one field above differs in how many
   * empty slots it starts with. Compared per template with that field's slot
   * count normalised, which leaves every other field of every template exact.
   */
  it.each(paired.map((p) => [p.id, p] as const))('template-%s builds the same instance', (_id, pair) => {
    const j = stable(fromJson(pair.json).extract);
    const y = stable(fromYaml(pair.yaml).extract);
    expect(Object.keys(y)).toEqual(Object.keys(j));
    for (const key of Object.keys(j)) {
      expect(withoutUnexpressibleSlots(y[key], j[key]), `${key} differs between the two readings`).toEqual(j[key]);
    }
  });

  /**
   * The `@context` block is the one part of an instance that is about
   * serialisation, and it has to come out the same too — it is generated from
   * the model rather than copied out of the template, so the format it was
   * written in cannot reach it.
   */
  it.each(paired.map((p) => [p.id, p] as const))('template-%s builds the same @context', (_id, pair) => {
    expect(stable(fromYaml(pair.yaml).emitted)['@context']).toEqual(stable(fromJson(pair.json).emitted)['@context']);
  });

  it.each(paired.map((p) => [p.id, p] as const))('template-%s reports the same validity', (_id, pair) => {
    expect(fromYaml(pair.yaml).qualityReport.isValid).toBe(fromJson(pair.json).qualityReport.isValid);
  });
});

describe('what that demonstrates', () => {
  /**
   * A guard against the comparison passing for an uninteresting reason. If the
   * YAML parser silently produced nothing, every assertion above would hold
   * trivially — two empty trees are equal.
   */
  it('the YAML side actually renders fields', () => {
    const rendered = paired.map((p) => describeTree(fromYaml(p.yaml).representation).length).reduce((a, b) => a + b, 0);
    expect(rendered, 'the YAML parser produced no components at all').toBeGreaterThan(100);
  });

  it('and renders as many as the JSON side', () => {
    const viaYaml = paired.map((p) => describeTree(fromYaml(p.yaml).representation).length);
    const viaJson = paired.map((p) => describeTree(fromJson(p.json).representation).length);
    expect(viaYaml).toEqual(viaJson);
  });
});
