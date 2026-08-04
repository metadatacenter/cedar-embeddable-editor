/**
 * An instance CEE emits as YAML reads back — through the library — to the same
 * JSON instance.
 *
 * This is the round trip the output side could not do before: the library had a
 * YAML instance *writer* but no *reader*, so `format-independence-generative`
 * could only map the YAML keys back by hand. With `YamlTemplateInstanceReader`
 * (values) and `InstanceInflater` (the template-supplied `@context` and empty
 * slots) it closes for real — CEE writes the instance as YAML, the library reads
 * it and inflates it against the template, and the JSON that comes out matches
 * the JSON CEE writes directly. Any value a writer dropped, or an IRI the
 * inflater failed to restore, breaks it.
 */
import { describe, expect, it } from 'vitest';
import { CedarReaders, CedarWriters, InstanceInflater } from 'cedar-model-typescript-library';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { buildTemplate, buildTemplateModel, type TemplateSpec } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';
import { CeeDriver, normalize } from '../src/driver';

const TEXT = FIELD_KINDS.find((k) => k.key === 'text')!;
const NUM = FIELD_KINDS.find((k) => k.key === 'numeric')!;
const CTRL = FIELD_KINDS.find((k) => k.key === 'controlled')!;

/** JSON, minus the parts a new instance has not got and the minted element ids. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (json: any): any => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json)) {
    if (k === '@id' || k === '@context' || k === 'schema:name' || k === 'schema:description') continue;
    out[k] = normalize(v);
  }
  return out;
};

describe('a CEE instance survives write-as-YAML then read + inflate back to JSON', () => {
  const spec: TemplateSpec = {
    name: 'RT',
    children: [
      { kind: TEXT, name: 'note' },
      { kind: NUM, name: 'count' },
      { kind: CTRL, name: 'org' },
    ],
    elements: [{ name: 'addr', children: [{ kind: TEXT, name: 'city' }] }],
  };

  const driver = new CeeDriver(buildTemplate(spec));
  driver.setValue(['_note'], TEXT, 'hello');
  driver.setValue(['_count'], NUM, '42');
  driver.setValue(['_org'], CTRL, 'Homo sapiens');
  driver.setValue(['_addr', '_city'], TEXT, 'Palo Alto');
  driver.expectNoErrors('roundtrip fill');

  const directJson = InstanceSerializer.toJson(driver.dataContext.instanceFullData) as Record<string, unknown>;
  const yaml = InstanceSerializer.toYaml(driver.dataContext.instanceFullData);

  const reModel = CedarReaders.yaml().getStrict().getTemplateInstanceReader().readFromString(yaml).instance;
  InstanceInflater.inflate(reModel, buildTemplateModel(spec));
  const roundTripJson = JSON.parse(
    CedarWriters.json().getStrict().getTemplateInstanceWriter().getAsJsonString(reModel),
  ) as Record<string, unknown>;

  it('reproduces every field value', () => {
    expect(data(roundTripJson)).toEqual(data(directJson));
  });

  it('restores the @context property IRIs the YAML dropped', () => {
    const context = roundTripJson['@context'] as Record<string, unknown>;
    for (const key of ['_note', '_count', '_org', '_addr']) {
      expect(typeof context[key], `@context is missing ${key}`).toBe('string');
    }
    const element = roundTripJson._addr as Record<string, unknown>;
    expect(typeof (element['@context'] as Record<string, unknown>)._city).toBe('string');
  });
});
