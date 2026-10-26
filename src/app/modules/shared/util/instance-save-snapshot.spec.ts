import { InstanceDataContainer, InstanceDataLinkAtom } from 'cedar-model-typescript-library';
import { captureInstanceSave } from './instance-save-snapshot';
import { CeeJsonObject } from '../../../cee-public-api';

describe('repository identity acknowledgement', () => {
  function fixture() {
    const root = new InstanceDataContainer();
    const first = new InstanceDataContainer();
    const second = new InstanceDataContainer();
    const nested = new InstanceDataContainer();
    first.setValue('Nested', nested);
    const link = InstanceDataLinkAtom.fromParsedNode('https://example.org/link', null);
    first.setValue('Link', link);
    root.setValue('Entries', [first, second]);
    // Every element occurrence carries its `@context`, as a written and a stored one do.
    const metadata: CeeJsonObject = {
      Entries: [
        {
          '@context': {},
          '@id': null,
          Nested: { '@context': {}, '@id': null },
          Link: { '@id': 'https://example.org/link' },
        },
        { '@context': {}, '@id': null },
      ],
    };
    const stored: CeeJsonObject = {
      Entries: [
        {
          '@context': {},
          '@id': 'urn:first',
          Nested: { '@context': {}, '@id': 'urn:nested' },
          Link: { '@id': 'https://example.org/link' },
        },
        { '@context': {}, '@id': 'urn:second' },
      ],
    };
    let current: InstanceDataContainer | null = root;
    let invalidated = 0;
    const snapshot = captureInstanceSave(
      metadata,
      root,
      () => current,
      () => invalidated++,
    );
    return {
      root,
      first,
      second,
      nested,
      link,
      metadata,
      stored,
      snapshot,
      replaceRoot: () => {
        current = new InstanceDataContainer();
      },
      invalidated: () => invalidated,
    };
  }

  it('acknowledges submitted objects after reordering, without giving new entries old IDs', () => {
    const f = fixture();
    const added = new InstanceDataContainer();
    f.root.setValue('Entries', [f.second, added, f.first]);
    f.first.setValue('Later', new InstanceDataContainer());
    const baseline = f.snapshot.acknowledge(f.stored);
    expect(f.snapshot.needsElementIds).toBe(true);
    expect([f.first.id, f.second.id, f.nested.id, added.id]).toEqual(['urn:first', 'urn:second', 'urn:nested', null]);
    expect((f.first.values['Later'] as InstanceDataContainer).id).toBeNull();
    expect(f.first.values['Link']).toBe(f.link);
    expect(baseline).toEqual(f.stored);
    expect(f.metadata['Entries']).toEqual(f.snapshot.metadata['Entries']);
    expect(f.invalidated()).toBe(1);
    expect(() => f.snapshot.acknowledge(f.stored)).toThrow();
  });

  it('does not resurrect a removed occurrence', () => {
    const f = fixture();
    f.root.setValue('Entries', [f.second]);
    f.snapshot.acknowledge(f.stored);
    expect(f.first.id).toBeNull();
    expect(f.nested.id).toBeNull();
    expect(f.second.id).toBe('urn:second');
  });

  it.each([
    {},
    {
      Entries: [
        { '@context': {}, '@id': 'urn:first' },
        { '@context': {}, '@id': 'urn:second' },
      ],
    },
    {
      Entries: [
        { '@context': {}, '@id': 'urn:first', Nested: { '@context': {}, '@id': 'urn:nested' } },
        { '@context': {}, '@id': '' },
      ],
    },
  ])('rejects incomplete identities atomically', (stored) => {
    const f = fixture();
    expect(() => f.snapshot.acknowledge(stored as CeeJsonObject)).toThrow();
    expect([f.first.id, f.second.id, f.nested.id]).toEqual([null, null, null]);
    expect(f.invalidated()).toBe(0);
  });

  it('rejects acknowledgements for a replaced form', () => {
    const f = fixture();
    f.replaceRoot();
    expect(() => f.snapshot.acknowledge(f.stored)).toThrow();
    expect(f.first.id).toBeNull();
  });

  it('does not partially apply identities when serialization omitted a container', () => {
    const f = fixture();
    const snapshot = captureInstanceSave(
      { Entries: [{ '@context': {}, Nested: {} }] },
      f.root,
      () => f.root,
      () => {},
    );
    expect(() => snapshot.acknowledge(f.stored)).toThrow();
    expect([f.first.id, f.second.id, f.nested.id]).toEqual([null, null, null]);
  });

  it('requires existing identities to remain unchanged', () => {
    const f = fixture();
    f.first.id = 'urn:existing';
    const snapshot = captureInstanceSave(
      f.metadata,
      f.root,
      () => f.root,
      () => {},
    );
    expect(() => snapshot.acknowledge(f.stored)).toThrow();
    expect(f.first.id).toBe('urn:existing');
    expect(f.second.id).toBeNull();
  });
});
