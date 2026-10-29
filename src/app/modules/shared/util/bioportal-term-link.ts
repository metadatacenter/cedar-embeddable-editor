import { ControlledInfo } from '../models/info/controlled-info.model';

/** Source attribution from stored constraints, independent of landing-page resolution. */
export const termAcronymOf = (controlled: ControlledInfo, iri: string): string | null => {
  const listed = controlled.classes.find((entry) => entry.uri === iri)?.source;
  if (listed) {
    return listed;
  }
  const acronyms = new Set(
    [
      ...controlled.branches.map((branch) => branch.acronym),
      ...controlled.ontologies.map((ontology) => ontology.acronym),
      ...controlled.classes.map((entry) => entry.source),
    ].filter((acronym): acronym is string => !!acronym),
  );
  return acronyms.size === 1 && controlled.valueSets.length === 0 ? [...acronyms][0] : null;
};
