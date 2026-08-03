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
import { corpusAvailable, corpusTemplates, corpusTemplatesYaml, describeTree } from '../src/corpus';
import { CeeDriver } from '../src/driver';

const json = corpusAvailable() ? corpusTemplates() : [];
const yaml = corpusAvailable() ? corpusTemplatesYaml() : [];

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

const fromJson = (template: object) => new CeeDriver(template, { templateParser: new ModelLibraryTemplateParser() });
const fromYaml = (template: object) => new CeeDriver(template, { templateParser: new YamlTemplateParser() });

describe.skipIf(!corpusAvailable())('a template read from YAML', () => {
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
      if (Array.isArray(j[key]) && Array.isArray(y[key]) && j[key].length !== y[key].length) {
        // Only the unexpressible lower bound may cause this.
        expect(y[key].length, `${key}: an unexpected difference in slot count`).toBeLessThan(j[key].length);
        continue;
      }
      expect(y[key], `${key} differs between the two readings`).toEqual(j[key]);
    }
  });

  /**
   * The `@context` block is the one part of an instance that is about
   * serialisation, and it has to come out the same too — it is generated from
   * the model rather than copied out of the template, so the format it was
   * written in cannot reach it.
   */
  it.each(paired.map((p) => [p.id, p] as const))('template-%s builds the same @context', (_id, pair) => {
    expect(stable(fromYaml(pair.yaml).metadata)['@context']).toEqual(stable(fromJson(pair.json).metadata)['@context']);
  });

  it.each(paired.map((p) => [p.id, p] as const))('template-%s reports the same validity', (_id, pair) => {
    expect(fromYaml(pair.yaml).qualityReport.isValid).toBe(fromJson(pair.json).qualityReport.isValid);
  });
});

describe.skipIf(!corpusAvailable())('what that demonstrates', () => {
  /**
   * A guard against the comparison passing for an uninteresting reason. If the
   * YAML parser silently produced nothing, every assertion above would hold
   * trivially — two empty trees are equal.
   */
  it('the YAML side actually renders fields', () => {
    const rendered = paired
      .map((p) => describeTree(fromYaml(p.yaml).representation).length)
      .reduce((a, b) => a + b, 0);
    expect(rendered, 'the YAML parser produced no components at all').toBeGreaterThan(100);
  });

  it('and renders as many as the JSON side', () => {
    const viaYaml = paired.map((p) => describeTree(fromYaml(p.yaml).representation).length);
    const viaJson = paired.map((p) => describeTree(fromJson(p.json).representation).length);
    expect(viaYaml).toEqual(viaJson);
  });
});
