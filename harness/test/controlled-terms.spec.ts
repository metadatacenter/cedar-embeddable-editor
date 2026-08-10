/**
 * Controlled-term constraints: the widest value space in the model.
 *
 * Exhaustive over the 15 non-empty subsets of {ontologies, classes, branches,
 * valueSets}, plus a multiplicity pass, plus the cardinality and nesting axes
 * that interact with them.
 *
 * Nothing in CEE's existing suite touches `ControlledInfo` at all, and the
 * override behaviour (any constraint present ⇒ inputType becomes `controlled`,
 * whatever the template declared) is both silent and load-bearing.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { CONSTRAINT_COMBINATIONS, MULTIPLICITY_COMBINATIONS, configureFor } from '../src/controlled';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { labelOf } from '../src/values';
import { JsonSchema } from 'cedar-model-typescript-library';

const controlledKind = (configure: (b: any) => any): FieldKind => ({
  key: 'term',
  inputType: 'controlled',
  make: () => CedarBuilders.controlledTermFieldBuilder(),
  isStatic: false,
  write: 'controlled',
  sample: 'Homo sapiens',
  configure,
});

describe('constraint-kind combinations', () => {
  it.each(CONSTRAINT_COMBINATIONS.map((c) => [c.label, c] as const))(
    '%s is parsed as a controlled field with all constraints intact',
    (_label, combo) => {
      const kind = controlledKind(configureFor(combo));
      const driver = new CeeDriver(buildTemplate({ name: `ct_${combo.label}`, children: [{ kind, name: 'term' }] }));
      const component = driver.findOrThrow(['_term']);

      // Presence of *any* constraint kind forces the controlled input type.
      expect(component.basicInfo.inputType).toBe('controlled');

      for (const k of combo.kinds) {
        expect(component.controlledInfo[k], `${k} missing from controlledInfo`).toBeTruthy();
        expect(component.controlledInfo[k].length, `${k} should have ${combo.counts[k]} entry`).toBe(combo.counts[k]);
      }
      driver.expectNoErrors(combo.label);
    },
  );

  it.each(MULTIPLICITY_COMBINATIONS.map((c) => [c.label, c] as const))(
    '%s preserves every entry, not just the first',
    (_label, combo) => {
      const kind = controlledKind(configureFor(combo));
      const driver = new CeeDriver(buildTemplate({ name: `ctm_${combo.label}`, children: [{ kind, name: 'term' }] }));
      const info = driver.findOrThrow(['_term']).controlledInfo;

      for (const [k, expected] of Object.entries(combo.counts)) {
        expect(info[k].length, `${k} truncated`).toBe(expected);
      }
    },
  );

  it('carries the constraint payload through, not just the count', () => {
    const combo = CONSTRAINT_COMBINATIONS.find((c) => c.label === 'ontologies')!;
    const kind = controlledKind(configureFor(combo));
    const driver = new CeeDriver(buildTemplate({ name: 'ct_payload', children: [{ kind, name: 'term' }] }));
    const [ontology] = driver.findOrThrow(['_term']).controlledInfo.ontologies as any[];

    expect(ontology.acronym).toBe('ONT0');
    expect(ontology.name).toBe('Ontology 0');
    expect(ontology.uri).toBe('https://data.bioontology.org/ontologies/ONT0');
  });
});

describe('controlled terms across cardinality and nesting', () => {
  const combos = CONSTRAINT_COMBINATIONS.filter((c) =>
    ['ontologies', 'classes', 'branches', 'valueSets', 'ontologies+classes+branches+valueSets'].includes(c.label),
  );

  const positions = [
    { name: 'single/root', cardinality: undefined, nested: false },
    { name: 'multi/root', cardinality: 'multi' as const, nested: false },
    { name: 'single/inMultiElement', cardinality: undefined, nested: true },
    { name: 'multi/inMultiElement', cardinality: 'multi' as const, nested: true },
  ];

  const cases = combos.flatMap((combo) =>
    positions.map((pos) => [`${combo.label} @ ${pos.name}`, combo, pos] as const),
  );

  it.each(cases)('%s round-trips a term value', (_label, combo, pos) => {
    const kind = controlledKind(configureFor(combo));
    const child = { kind, name: 'term', cardinality: pos.cardinality };
    const template = pos.nested
      ? buildTemplate({
          name: `ctn_${combo.label}_${pos.name}`,
          elements: [{ name: 'wrap', cardinality: 'multi', minItems: 2, children: [child] }],
        })
      : buildTemplate({ name: `ctn_${combo.label}_${pos.name}`, children: [child] });

    const path = pos.nested ? ['_wrap', '_term'] : ['_term'];
    const driver = new CeeDriver(template);

    expect(driver.findOrThrow(path).basicInfo.inputType).toBe('controlled');

    driver.setValue(path, kind);
    driver.expectNoErrors(_label);

    const node: any = driver.handlerContext.getDataObjectNodeByPath(path);
    const one = Array.isArray(node) ? node[0] : node;
    // changeControlledValue writes the IRI plus its label; both must land.
    expect(labelOf(one)).toBe(kind.sample);
    expect(one[JsonSchema.atId]).toBe(`https://example.org/terms/${encodeURIComponent(kind.sample)}`);
  });
});

describe('controlled term values survive a save/reload cycle', () => {
  /**
   * The reload path reconstructs everything from the instance alone. For a
   * controlled term that means the `{@id, rdfs:label}` pair has to survive
   * `DataObjectUtil.deleteContext`, which has an explicit carve-out for
   * exactly this shape — a two-key object of `@id` + `rdfs:label` is left
   * alone rather than stripped.
   */
  it.each(CONSTRAINT_COMBINATIONS.map((c) => [c.label, c] as const))('%s', (_label, combo) => {
    const kind = controlledKind(configureFor(combo));
    const template = buildTemplate({ name: `ctr_${combo.label}`, children: [{ kind, name: 'term' }] });

    const first = new CeeDriver(template);
    first.setValue(['_term'], kind);
    const saved = first.metadata;

    const reloaded = new CeeDriver(template, { instance: saved });
    const node: any = reloaded.handlerContext.getDataObjectNodeByPath(['_term']);

    expect(labelOf(node)).toBe(kind.sample);
    reloaded.expectNoErrors(`reload ${combo.label}`);
  });
});
