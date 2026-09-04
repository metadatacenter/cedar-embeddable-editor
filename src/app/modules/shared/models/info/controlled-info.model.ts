/**
 * A controlled field's `_valueConstraints`, as CEDAR declares them.
 *
 * The four arrays were `Array<object>`, which said only that entries exist — so
 * `branch['source']` and `ontology['acronym']` type-checked against nothing. Each
 * kind carries its own identifying key, and the BioPortal link built in
 * `cedar-input-controlled` picks a different one per kind, which is the reason the
 * distinction matters here rather than being flattened into one shape.
 *
 * Optional throughout: these come from template JSON that CEE does not author, and
 * a constraint may name a branch without a `maxDepth`, or a value set without an
 * acronym. Only `uri` is reliably present on all four.
 */
export interface OntologyConstraint {
  uri?: string;
  acronym?: string;
  name?: string;
  numTerms?: number;
}

export interface BranchConstraint {
  uri?: string;
  source?: string;
  acronym?: string;
  name?: string;
  maxDepth?: number;
}

export interface ClassConstraint {
  uri?: string;
  source?: string;
  label?: string;
  prefLabel?: string;
  type?: string;
}

export interface ValueSetConstraint {
  uri?: string;
  vsCollection?: string;
  name?: string;
  numTerms?: number;
}

/**
 * One entry of `_valueConstraints.actions`: the arrangement an author applied to
 * the values a constraint offers. A `delete` action drops a term from the list, and
 * a `move` action puts one at the position `to` names.
 *
 * The terminology server applies these, which is why CEE forwards them rather than
 * filtering the results it gets back. A `delete` action carries no `to`, and the
 * remaining keys are optional for the same reason the four source kinds' are.
 */
export interface ActionConstraint {
  action?: string;
  termUri?: string;
  sourceUri?: string;
  source?: string;
  type?: string;
  to?: number;
}

export class ControlledInfo {
  /** Empty for a field constrained by none of that kind, which most fields are. */
  ontologies: OntologyConstraint[] = [];
  valueSets: ValueSetConstraint[] = [];
  classes: ClassConstraint[] = [];
  branches: BranchConstraint[] = [];
  /** The author's arrangement of the offered values, empty for a field with none. */
  actions: ActionConstraint[] = [];
}
