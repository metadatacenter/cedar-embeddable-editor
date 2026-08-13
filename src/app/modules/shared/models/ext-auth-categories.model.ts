import { InputType } from './input-type.model';

export const EXTERNAL_AUTHORITY_INPUT_TYPES: ReadonlySet<InputType> = new Set<InputType>([
  InputType.orcid,
  InputType.ror,
  InputType.pfas,
  InputType.pmid,
  InputType.rrid,
  InputType.nihGrant,
  InputType.doi,
]);

/**
 * True when the field's value *is* its IRI.
 *
 * A node of `{'@id': …, 'rdfs:label': …}` is a term to be shown by its label if
 * the field is a controlled term, and a resource to be shown by its IRI if the
 * field is a link or one of the external authority types. The instance carries
 * nothing that distinguishes the two, so only the template can settle it — and
 * every place that reads a value out of an instance has to settle it the same
 * way.
 *
 * Getting it wrong in one place is what made a filled ORCID field report as
 * empty, and separately what made a filled ORCID occurrence draw "null" in the
 * pager: both had their own copy of the rule and both left the external
 * authority types out of it.
 *
 * Not the same question as `DataObjectUtil.isIriValued`, which asks whether the
 * field's *empty* slot is `{}` — a controlled term's is, and its value is still
 * its label.
 */
export const valueIsIri = (inputType: InputType): boolean =>
  inputType === InputType.link || EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType);
