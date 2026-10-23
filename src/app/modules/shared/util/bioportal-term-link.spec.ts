import { describe, expect, it } from 'vitest';
import { ControlledInfo } from '../models/info/controlled-info.model';
import { bioPortalTermLink, termAcronymOf } from './bioportal-term-link';

const HRAVS_TERM = 'https://purl.humanatlas.io/vocab/hravs#HRAVS_0000123';

const constraints = (shape: Partial<ControlledInfo>): ControlledInfo => Object.assign(new ControlledInfo(), shape);

describe('termAcronymOf', () => {
  it('names the ontology of a field whose branch is its only source', () => {
    const controlled = constraints({ branches: [{ uri: 'https://purl.humanatlas.io/vocab/hravs#datasets', acronym: 'HRAVS' }] });
    expect(termAcronymOf(controlled, HRAVS_TERM)).toBe('HRAVS');
  });

  it('names the ontology every source agrees on', () => {
    const controlled = constraints({
      ontologies: [{ acronym: 'DOID' }],
      branches: [{ acronym: 'DOID', uri: 'http://purl.obolibrary.org/obo/DOID_4' }],
    });
    expect(termAcronymOf(controlled, 'http://purl.obolibrary.org/obo/DOID_2841')).toBe('DOID');
  });

  it('names the ontology of a class that lists the term, among several ontologies', () => {
    const controlled = constraints({
      ontologies: [{ acronym: 'NCIT' }],
      classes: [{ uri: 'http://purl.obolibrary.org/obo/DOID_2841', source: 'DOID', prefLabel: 'asthma' }],
    });
    expect(termAcronymOf(controlled, 'http://purl.obolibrary.org/obo/DOID_2841')).toBe('DOID');
  });

  it('names none when the sources span several ontologies or add a value set', () => {
    const several = constraints({ ontologies: [{ acronym: 'NCIT' }, { acronym: 'DOID' }] });
    const withValueSet = constraints({ ontologies: [{ acronym: 'NCIT' }], valueSets: [{ vsCollection: 'CADSR-VS' }] });
    const none = constraints({ ontologies: [{ uri: 'https://data.bioontology.org/ontologies/X' }] });
    expect(termAcronymOf(several, HRAVS_TERM)).toBeNull();
    expect(termAcronymOf(withValueSet, HRAVS_TERM)).toBeNull();
    expect(termAcronymOf(none, HRAVS_TERM)).toBeNull();
  });
});

describe('bioPortalTermLink', () => {
  it('links a listed class to its own ontology, not the first one the field names', () => {
    const controlled = constraints({
      ontologies: [{ acronym: 'NCIT' }],
      classes: [{ uri: 'http://purl.obolibrary.org/obo/DOID_2841', source: 'DOID' }],
    });
    expect(bioPortalTermLink(controlled, 'http://purl.obolibrary.org/obo/DOID_2841')).toBe(
      'https://bioportal.bioontology.org/ontologies/DOID?p=classes&conceptid=http%3A%2F%2Fpurl.obolibrary.org%2Fobo%2FDOID_2841',
    );
  });

  it('keeps linking an unsettled term to the first ontology the field names', () => {
    const controlled = constraints({ ontologies: [{ acronym: 'NCIT' }, { acronym: 'DOID' }] });
    expect(bioPortalTermLink(controlled, HRAVS_TERM)).toMatch(/^https:\/\/bioportal\.bioontology\.org\/ontologies\/NCIT\?/);
  });
});
