/**
 * The keys a CEDAR JSON document is written in, as this suite refers to them.
 *
 * The suite's own, not the model library's. These were read from `JsonSchema`,
 * which is the library's internal spelling table — how its readers and writers
 * talk to each other about a document they are in the middle of building. That
 * it is exported at all was an accident of convenience, and borrowing from it
 * made a test's claim look like it came from somewhere authoritative when the
 * test is the thing making the claim.
 *
 * A spec that says "the emitted instance carries an `@id`" is asserting
 * something about the document, and should say `@id` in its own words. If the
 * library ever changed how it spells one, these would fail — which is the right
 * outcome, because the emitted document would have changed and that is what the
 * assertions are about.
 *
 * Only for claims about a *document*. Nothing here belongs in a claim about what
 * a field holds: that is `values.ts`, and it names no keys at all.
 */
export const DocumentKey = {
  atId: '@id',
  atType: '@type',
  atValue: '@value',
  atContext: '@context',
  rdfsLabel: 'rdfs:label',
  schemaIsBasedOn: 'schema:isBasedOn',
  schemaName: 'schema:name',
  schemaDescription: 'schema:description',
  pavCreatedOn: 'pav:createdOn',
  pavCreatedBy: 'pav:createdBy',
  pavLastUpdatedOn: 'pav:lastUpdatedOn',
  oslcModifiedBy: 'oslc:modifiedBy',
} as const;
