/**
 * The same generated template, written as JSON or as YAML, behaves identically —
 * across every field kind, and after the field is filled.
 *
 * `format-independence.spec.ts` already makes this claim, but only over the 37
 * corpus templates, only for the empty skeleton, and only when the corpus is
 * present (it is skipped otherwise). That leaves the claim unproven exactly
 * where the generative harness is strongest: every field kind in isolation, and
 * the *populated* instance — the edit path, which is where a serialization that
 * silently lost a construct would actually bite.
 *
 * This closes both. For each field kind it builds one template, writes it down
 * both ways through the model library's own writers, reads each back through the
 * matching parser, and asserts the rendered form and the filled instance are the
 * same. YAML is not a relabelled JSON object here: the YAML *text* is produced
 * by `CedarWriters.yaml()` and read by `CedarReaders.yaml()` (via
 * `YamlTemplateParser`), so any place CEE still took meaning from the JSON shape
 * rather than the model would surface as a divergence.
 *
 * Single cardinality throughout, deliberately: a field that is multiple by type
 * carries a `minItems` the YAML serialization cannot express (documented in
 * `format-independence.spec.ts`), and the generative builder only emits that
 * bound for an explicitly multi child. Staying single keeps the two readings
 * exactly equal with nothing to forgive.
 */
import { describe, expect, it } from 'vitest';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { ModelLibraryTemplateParser } from '@cee/factory/model-library-template-parser';
import { YamlTemplateParser } from '@cee/factory/yaml-template-parser';
import { buildTemplate, buildTemplateYaml, supportsMultiInstance, type TemplateSpec } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';
import { CeeDriver, normalize } from '../src/driver';
import { describeTree } from '../src/corpus';

const fromJson = (spec: TemplateSpec) =>
  new CeeDriver(buildTemplate(spec), { templateParser: new ModelLibraryTemplateParser() });
const fromYaml = (spec: TemplateSpec) =>
  new CeeDriver(buildTemplateYaml(spec), { templateParser: new YamlTemplateParser() });

/** A minted attribute-value property IRI, non-deterministic like an element-instance `@id`. */
const MINTED_ATTR = /^https:\/\/schema\.metadatacenter\.org\/properties\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const stripAttrIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripAttrIds);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = typeof v === 'string' && MINTED_ATTR.test(v) ? '<attr>' : stripAttrIds(v);
    return out;
  }
  return value;
};

// CEE mints a fresh GUID onto every element instance it builds and onto every
// attribute-value property, so the two drivers' ids never match literally.
// Normalized away — the same treatment the corpus round-trip and snapshot specs
// give minted ids — leaving everything else, including every written value,
// compared exactly.
const emitted = (driver: CeeDriver) =>
  stripAttrIds(normalize(InstanceSerializer.toJson(driver.dataContext.instanceFullData)));

const TEXT = FIELD_KINDS.find((k) => k.key === 'text')!;

// No serialization carries anything the other cannot: every field kind reads and
// fills identically whether the template arrived as JSON or as YAML. There is no
// allowlist — a divergence here is a gap in the TypeScript library to fix, the
// way the numeric-datatype default was, not something to forgive.
const writable = FIELD_KINDS.filter((k) => !k.isStatic && k.write !== 'none');
const multiCapable = writable.filter((k) => supportsMultiInstance(k));

describe('a generated template renders the same form whether read as JSON or YAML', () => {
  it.each(FIELD_KINDS.map((k) => [k.key, k] as const))('%s: same rendered tree', (_key, kind) => {
    const spec: TemplateSpec = { name: `fi_${kind.key}`, children: [{ kind, name: 'f' }] };
    expect(describeTree(fromYaml(spec).representation)).toEqual(describeTree(fromJson(spec).representation));
  });

  it('a field nested in an element renders the same', () => {
    const spec: TemplateSpec = { name: 'fi_el', elements: [{ name: 'addr', children: [{ kind: TEXT, name: 'city' }] }] };
    expect(describeTree(fromYaml(spec).representation)).toEqual(describeTree(fromJson(spec).representation));
  });
});

describe('a filled field yields the same instance whether the template was JSON or YAML', () => {
  it.each(writable.map((k) => [k.key, k] as const))(
    '%s: same emitted instance after a write',
    (_key, kind) => {
      const spec: TemplateSpec = { name: `fv_${kind.key}`, children: [{ kind, name: 'f' }] };
      const viaJson = fromJson(spec);
      const viaYaml = fromYaml(spec);
      viaJson.setValue(['_f'], kind, kind.sample);
      viaYaml.setValue(['_f'], kind, kind.sample);
      viaJson.expectNoErrors(`${kind.key} via JSON`);
      viaYaml.expectNoErrors(`${kind.key} via YAML`);
      expect(emitted(viaYaml)).toEqual(emitted(viaJson));
    },
  );

  it('a value written into a nested element matches across formats', () => {
    const spec: TemplateSpec = { name: 'fv_el', elements: [{ name: 'addr', children: [{ kind: TEXT, name: 'city' }] }] };
    const viaJson = fromJson(spec);
    const viaYaml = fromYaml(spec);
    viaJson.setValue(['_addr', '_city'], TEXT, 'Palo Alto');
    viaYaml.setValue(['_addr', '_city'], TEXT, 'Palo Alto');
    expect(emitted(viaYaml)).toEqual(emitted(viaJson));
  });
});

/**
 * The multiple-instance bound survives the crossing too.
 *
 * A field deployed multiple carries `minItems`/`maxItems` that YAML records in a
 * `configuration:` block — so an explicitly-multiple field, unlike the by-type
 * multiples the corpus spec forgives, round-trips its bounds losslessly. Both
 * the rendered form and a written value are compared, for every kind the library
 * lets be multi-instance.
 */
describe('a multiple-instance field renders and fills the same across formats', () => {
  it.each(multiCapable.map((k) => [k.key, k] as const))('%s (multi): same tree and instance', (_key, kind) => {
    const spec: TemplateSpec = {
      name: `fm_${kind.key}`,
      children: [{ kind, name: 'f', cardinality: 'multi', minItems: 1, maxItems: 3 }],
    };
    const viaJson = fromJson(spec);
    const viaYaml = fromYaml(spec);
    expect(describeTree(viaYaml.representation)).toEqual(describeTree(viaJson.representation));
    viaJson.setValue(['_f'], kind, kind.sample);
    viaYaml.setValue(['_f'], kind, kind.sample);
    expect(emitted(viaYaml)).toEqual(emitted(viaJson));
  });
});
