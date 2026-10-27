import { ControlledInfo } from './info/controlled-info.model';
import { SpecTermSource, controlledTermSourcesOf } from '../util/field-spec';

export interface ResourceReference {
  kind: string;
  sourceSystem?: string;
  sourceAcronym: string;
  sourceIri?: string;
  resourceIri?: string;
  versionId?: string;
}

export interface ResourceLink {
  rel: string;
  icon?: string;
  href: string;
  label: string;
  versionScope: 'current' | 'exact';
}

export interface ResourceDescription {
  ref: ResourceReference;
  label?: string;
  description?: string;
  language?: string;
  status: string;
  reason?: string;
  replacedBy?: string;
  authorityLabel?: string;
  links: ResourceLink[];
  capabilities: string[];
}

/** Consume a declared public link; an identifier is never guessed to be a landing page. */
export function landingLink(resource: ResourceDescription | null | undefined): ResourceLink | null {
  if (!resource || resource.status === 'unavailable') return null;
  return (
    resource.links?.find((link) => {
      if (link.rel !== 'landing' || !['current', 'exact'].includes(link.versionScope)) return false;
      try {
        const url = new URL(link.href);
        return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
      } catch {
        return false;
      }
    }) ?? null
  );
}

export function sourceReference(source: SpecTermSource): ResourceReference | null {
  if (!source.acronym) return null;
  return {
    kind: source.kind === 'ontology' ? 'vocabulary' : ['class', 'value'].includes(source.kind) ? 'term' : source.kind,
    sourceAcronym: source.acronym,
    ...(source.sourceSystem ? { sourceSystem: source.sourceSystem } : {}),
    ...(source.sourceIri ? { sourceIri: source.sourceIri } : {}),
    ...(source.uri ? { resourceIri: source.uri } : {}),
    ...(source.versionId ? { versionId: source.versionId } : {}),
  };
}

/** A stored term has no source; infer it only when the constraints identify one unambiguously. */
export function termReference(controlled: ControlledInfo, iri: string | null | undefined): ResourceReference | null {
  if (!iri) return null;
  const all = controlledTermSourcesOf(controlled);
  const exact = all.filter((source) => ['class', 'value'].includes(source.kind) && source.uri === iri);
  const refs = (exact.length ? exact : all)
    .map(sourceReference)
    .filter((ref): ref is ResourceReference => !!ref)
    .map((ref) => ({ ...ref, kind: 'term', resourceIri: iri }));
  const unique = new Map(refs.map((ref) => [JSON.stringify(ref), ref]));
  return unique.size === 1 ? [...unique.values()][0] : null;
}
