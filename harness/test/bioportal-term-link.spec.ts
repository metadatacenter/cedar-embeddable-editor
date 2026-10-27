import { describe, expect, it } from 'vitest';
import { landingLink, sourceReference, termReference, ResourceDescription } from '@cee/models/terminology-resource';
import { ControlledInfo } from '@cee/models/info/controlled-info.model';

const resource = (href: string): ResourceDescription => ({
  ref: {
    kind: 'term',
    sourceSystem: 'future',
    sourceAcronym: 'X',
    resourceIri: 'urn:example:one',
    versionId: 'hash-1',
  },
  status: 'available',
  authorityLabel: 'Future registry',
  capabilities: ['members', 'unknown-future-capability'],
  links: [{ rel: 'landing', href, label: 'Future registry', versionScope: 'current' }],
});

describe('generic terminology descriptions', () => {
  it('uses the supplied landing page independently of the identifier or provider', () => {
    expect(landingLink(resource('https://unknown.example/record/123'))?.href).toBe(
      'https://unknown.example/record/123',
    );
  });
  it.each(['javascript:alert(1)', 'data:text/html,hello', '/relative', 'https://user:password@example.org/'])(
    'rejects unsafe link %s',
    (href) => {
      expect(landingLink(resource(href))).toBeNull();
    },
  );
  it('keeps unavailable resources and resources with no landing page unlinked', () => {
    expect(landingLink({ ...resource('https://example.org'), status: 'unavailable' })).toBeNull();
    expect(landingLink({ ...resource('https://example.org'), links: [] })).toBeNull();
  });
  it('preserves each set reference, source identity and exact pin', () => {
    for (const uri of ['urn:set:one', 'urn:set:two']) {
      expect(
        sourceReference({
          kind: 'valueSet',
          acronym: 'X',
          name: 'Set',
          container: null,
          uri,
          sourceSystem: 'future',
          sourceIri: 'urn:source:x',
          versionId: 'hash-1',
        }),
      ).toEqual({
        kind: 'valueSet',
        sourceAcronym: 'X',
        sourceSystem: 'future',
        sourceIri: 'urn:source:x',
        resourceIri: uri,
        versionId: 'hash-1',
      });
    }
  });
  it('resolves a selected term across two sets from one collection without combining the sets', () => {
    const controlled = Object.assign(new ControlledInfo(), {
      valueSets: ['one', 'two'].map((id) => ({
        uri: 'urn:set:' + id,
        vsCollection: 'X',
        sourceSystem: 'future',
        version: { id: 'hash-1' },
      })),
    });
    expect(termReference(controlled, 'urn:term:3')).toEqual({
      kind: 'term',
      sourceAcronym: 'X',
      sourceSystem: 'future',
      versionId: 'hash-1',
      resourceIri: 'urn:term:3',
    });
    expect(controlled.valueSets).toHaveLength(2);
  });
  it('does not guess between sources or different pins of the same source', () => {
    const controlled = Object.assign(new ControlledInfo(), {
      branches: [
        { acronym: 'X', version: { id: 'one' } },
        { acronym: 'X', version: { id: 'two' } },
      ],
    });
    expect(termReference(controlled, 'urn:term:3')).toBeNull();
  });
  it('uses an explicit class source ahead of an ambiguous field-wide source', () => {
    const controlled = Object.assign(new ControlledInfo(), {
      classes: [{ uri: 'urn:term:3', source: 'X' }],
      ontologies: [{ acronym: 'Y' }],
    });
    expect(termReference(controlled, 'urn:term:3')?.sourceAcronym).toBe('X');
  });
});
