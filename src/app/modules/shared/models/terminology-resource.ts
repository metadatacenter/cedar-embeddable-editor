import { ControlledInfo } from './info/controlled-info.model';
import { SpecTermSource, controlledTermSourcesOf } from '../util/field-spec';
import type { ConstraintReference, ConstraintLinks } from './generated/terminology-links';
export type { ConstraintReference, ConstraintLinks, ResourceDescription } from './generated/terminology-links';

import { readConstraintLinks } from 'cedar-model-typescript-library';

/** Runtime shape validation comes from the shared CEDAR model. */
export function landingLink(links: ConstraintLinks | null | undefined): ConstraintLinks | null {
  if (links == null) return null;
  try {
    return readConstraintLinks(links);
  } catch {
    return null;
  }
}

export function sourceReference(source: SpecTermSource): ConstraintReference | null {
  if (!source.acronym) return null;
  const common = {
    sourceAcronym: source.acronym,
    ...(source.sourceSystem ? { sourceSystem: source.sourceSystem } : {}),
    ...(source.sourceIri ? { sourceIri: source.sourceIri } : {}),
    ...(source.versionId ? { version: { id: source.versionId } } : {}),
  };
  switch (source.kind) {
    case 'ontology':
      return { type: 'ontology', ...common };
    case 'branch':
    case 'valueSet':
      return source.uri ? { type: source.kind, ...common, termBaseIri: source.uri } : null;
    case 'class':
    case 'value':
      return source.uri ? { type: 'class', ...common, termIri: source.uri } : null;
    default:
      return null;
  }
}

/** The instance has an identifier and label; its template supplies source and version context. */
export function termReference(controlled: ControlledInfo, iri: string | null | undefined): ConstraintReference | null {
  if (!iri) return null;
  const all = controlledTermSourcesOf(controlled);
  const exact = all.filter((source) => ['class', 'value'].includes(source.kind) && source.uri === iri);
  const refs = (exact.length ? exact : all)
    .filter((source) => !!source.acronym)
    .map((source): ConstraintReference => ({
      type: 'class',
      sourceAcronym: source.acronym!,
      termIri: iri,
      ...(source.sourceSystem ? { sourceSystem: source.sourceSystem } : {}),
      ...(source.sourceIri ? { sourceIri: source.sourceIri } : {}),
      ...(source.versionId ? { version: { id: source.versionId } } : {}),
    }));
  const unique = new Map(refs.map((ref) => [JSON.stringify(ref), ref]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
