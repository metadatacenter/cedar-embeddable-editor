/**
 * A stored instance that omits a repeated child whose lower bound is above zero.
 *
 * Only a legacy instance can: the server validates every write, and an instance
 * that leaves out a required child fails that. CEE shows the instance as stored,
 * so the form has no occurrences of the child, and it writes what the form
 * shows: an empty list. The model library's inflater would start the child at
 * its lower bound, which is what a new form shows, but here it would save
 * entries the user never saw. The cost is stated rather than hidden: the empty
 * list is below the lower bound, so the server refuses the save until the user
 * adds an entry.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { validateWithRawSchema } from '../src/instance-conformance';

const text = FIELD_KINDS.find((kind) => kind.key === 'text')!;

const template = buildTemplate({
  name: 'omitted_repeated',
  children: [
    { kind: text, name: 'note' },
    { kind: text, name: 'aliases', cardinality: 'multi', minItems: 2, maxItems: 5 },
  ],
  elements: [
    { name: 'group', cardinality: 'multi', minItems: 2, maxItems: 5, children: [{ kind: text, name: 'member' }] },
  ],
});

const omitting = (key: string): object => {
  const stored = structuredClone(new CeeDriver(template).emitted);
  delete stored[key];
  return stored;
};

describe('a stored instance that omits a repeated child', () => {
  it.each(['_aliases', '_group'])('a new form starts %s at its lower bound', (key) => {
    expect(new CeeDriver(template).emitted[key]).toHaveLength(2);
  });

  it.each(['_aliases', '_group'])('%s is written as the empty list the form shows', (key) => {
    const driver = new CeeDriver(template, { instance: omitting(key) });
    expect(driver.fullData.values[key] ?? []).toEqual([]);
    expect(driver.emitted[key]).toEqual([]);
  });

  it.each(['_aliases', '_group'])('the server would refuse %s until an entry is added', (key) => {
    const result = validateWithRawSchema(template, new CeeDriver(template, { instance: omitting(key) }).emitted);
    expect(result.count).toBe(1);
    expect(result.detail).toContain('minItems');
  });
});
