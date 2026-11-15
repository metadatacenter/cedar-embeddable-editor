/**
 * A stated null the stored template requires survives CEE's save.
 *
 * A field value can state `rdfs:label` as null, and a stored template can require the key of
 * the value. The model library keeps such a null when it completes an instance against the
 * template it read, using the records its readers leave beside the instance and the template.
 * CEE writes what a host saves from its live instance, so those records have to reach the
 * library's writer. When CEE completed a deep copy instead, the copy carried no records, the
 * written document dropped the label, and the server refused an instance it had stored.
 */
import { describe, expect, it } from 'vitest';
import { CedarReaders, InstanceValidator, JsonNode } from 'cedar-model-typescript-library';
import { ceeSuiteCases } from '../src/corpus';
import { CeeDriver } from '../src/driver';

const FIELD = 'Datetime Field 1 (month/year)';
const suite = ceeSuiteCases().find((entry) => entry.id === '017');

type Node = Record<string, unknown>;

/** Template 017 as stored, its field's value schema requiring `rdfs:label` where `requiresLabel` is set. */
const storedTemplate = (requiresLabel: boolean): Node => {
  const template = structuredClone(suite!.template) as unknown as Node;
  const field = (template.properties as Record<string, Node>)[FIELD];
  if (requiresLabel) field.required = [...(field.required as string[]), 'rdfs:label'];
  return template;
};

/** Instance 017 as stored, its field stating a null label. */
const storedInstance = (): Node => {
  const instance = structuredClone(suite!.instance) as unknown as Node;
  instance[FIELD] = { ...(instance[FIELD] as Node), 'rdfs:label': null };
  return instance;
};

/** Whether the server would store `document` against the template as stored. */
const serverStores = (template: Node, document: Node): boolean => {
  const parsed = CedarReaders.json()
    .getFebruary2024()
    .getTemplateReader()
    .readFromObject(template as JsonNode).template;
  const read = CedarReaders.json()
    .getFebruary2024()
    .getTemplateInstanceReader()
    .readFromObject(document as JsonNode);
  return InstanceValidator.validateReport(read.instance, parsed, template as JsonNode).canSave;
};

const opened = async (template: Node): Promise<CeeDriver> => {
  const driver = new CeeDriver(template, { instance: storedInstance() });
  await driver.settled();
  return driver;
};

describe('a stated null label', () => {
  it('is in the corpus case it is tested on', () => {
    expect(suite?.template).toBeTruthy();
    expect((suite?.instance as Node | null)?.[FIELD]).toBeTruthy();
  });

  it('is written, and the instance can be saved, where the stored template requires it', async () => {
    const template = storedTemplate(true);
    const driver = await opened(template);
    const emitted = driver.emitted as Node;
    expect(Object.entries(emitted[FIELD] as Node)).toEqual([
      ['@value', '2023-08-31'],
      ['rdfs:label', null],
      ['@type', 'xsd:date'],
    ]);
    expect(serverStores(template, emitted)).toBe(true);
    expect(driver.qualityReport.canSave).toBe(true);
  });

  it('is written every time a host reads the instance, without changing the instance CEE holds', async () => {
    const driver = await opened(storedTemplate(true));
    const first = driver.emitted as Node;
    expect(driver.emitted).toEqual(first);
    expect(Object.keys(driver.emitted[FIELD] as Node)).toEqual(['@value', 'rdfs:label', '@type']);
  });

  it('is left out where the stored template does not require it', async () => {
    const template = storedTemplate(false);
    const driver = await opened(template);
    const emitted = driver.emitted as Node;
    expect(Object.keys(emitted[FIELD] as Node)).toEqual(['@value', '@type']);
    expect(serverStores(template, emitted)).toBe(true);
    expect(driver.qualityReport.canSave).toBe(true);
  });
});
