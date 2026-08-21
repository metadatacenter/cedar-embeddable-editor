import { ControlledInfo } from '../models/info/controlled-info.model';
import { SpecTermSource } from './field-spec';

/**
 * Where a controlled term can be read about, as a link out to BioPortal.
 *
 * BioPortal's own web UI, which is not a deployment's to configure. This was
 * `bioPortalPrefix`, a configuration key named as a prefix and used as a link
 * base — and only for two of the three constraint kinds that reach here, because
 * a branch was linked through its own `source` instead.
 *
 * That branch path was broken for real templates. `source` is not a URL: across
 * the corpus a branch carries `"Medical Subject Headings (MESH)"`, or
 * `"Ontology for Generic Dataset Metadata Template (FDC-GDMT)"`, or occasionally
 * `"https://bioportal.bioontology.org/ontologies/FDC-GDMT"` — a display name in
 * two cases out of three. Concatenated with the query it produced
 * `Medical Subject Headings (MESH)?p=classes&conceptid=…`, a relative URL
 * resolved against whatever page CEE was embedded in.
 *
 * The acronym is what every kind reliably carries, so every kind is now built the
 * same way: the acronym under BioPortal's ontologies path. A class states it in
 * `source`, which for a class holds `"MESH"` rather than a name — the one place
 * the CEDAR constraint shapes disagree about which key means what.
 */
const BIOPORTAL_ONTOLOGIES = 'https://bioportal.bioontology.org/ontologies/';

/** The acronym this field's constraint names, whichever kind of constraint it is. */
const acronymOf = (controlled: ControlledInfo): string | undefined =>
  controlled.branches[0]?.acronym ?? controlled.classes[0]?.source ?? controlled.ontologies[0]?.acronym;

export const bioPortalTermLink = (controlled: ControlledInfo, iri: string | undefined | null): string | null => {
  if (!iri) {
    return null;
  }
  const acronym = acronymOf(controlled);
  if (acronym === undefined || acronym === '') {
    return null;
  }
  return `${BIOPORTAL_ONTOLOGIES}${encodeURIComponent(acronym)}?p=classes&conceptid=${encodeURIComponent(iri)}`;
};

/**
 * Where an authority itself can be read about, as against a term drawn from it.
 *
 * The per-value link above answers "what is this term?"; this answers "what may I put here?", which
 * is the question a specification raises. A branch and a class point at a concept page, since both
 * name one node in a tree; an ontology and a value set point at the collection's own page.
 *
 * Null when the source carries no acronym, because BioPortal addresses everything by acronym and a
 * link built without one lands on the ontologies index — worse than no link, since it looks answered.
 */
export const bioPortalSourceLink = (source: SpecTermSource): string | null => {
  if (source.acronym === null || source.acronym === '') {
    return null;
  }
  const base = `${BIOPORTAL_ONTOLOGIES}${encodeURIComponent(source.acronym)}`;
  const pointsAtOneConcept = source.kind === 'branch' || source.kind === 'class';
  return pointsAtOneConcept && source.uri !== null
    ? `${base}?p=classes&conceptid=${encodeURIComponent(source.uri)}`
    : base;
};
