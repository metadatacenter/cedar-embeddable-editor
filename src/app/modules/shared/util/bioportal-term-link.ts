import { ControlledInfo } from '../models/info/controlled-info.model';

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
