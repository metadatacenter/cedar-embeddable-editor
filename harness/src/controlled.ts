/**
 * Controlled-term constraint construction and enumeration.
 *
 * Controlled terms are the widest value space in the CEDAR model. A single
 * field can be constrained by four independent constraint kinds, each a list,
 * each carrying its own properties:
 *
 *   ontologies  — uri, acronym, name, numTerms
 *   classes     — uri, source, label, prefLabel, type
 *   branches    — uri, source, acronym, name, maxDepth
 *   valueSets   — uri, vsCollection, name, numTerms
 *
 * CEE flattens all four into `ControlledInfo` and — critically — uses their
 * mere presence to *override* the declared input type:
 * `TemplateObjectUtil.hasControlledInfo()` returns true if any list is
 * non-empty, and `extractValueConstraints` then forces `inputType` to
 * `controlled`. So the interesting axis is not the term values themselves but
 * which *combination* of constraint kinds is present, and whether all four
 * survive parsing intact.
 *
 * That's 15 non-empty subsets of a 4-element set — small enough to enumerate
 * exhaustively, which is what `CONSTRAINT_COMBINATIONS` does.
 */
import {
  BioportalTermType,
  ControlledTermBranchBuilder,
  ControlledTermClassBuilder,
  ControlledTermOntologyBuilder,
  ControlledTermValueSetBuilder,
  Iri,
} from 'cedar-model-typescript-library';

/** The four constraint kinds, as CEE names them on `ControlledInfo`. */
export const CONSTRAINT_KINDS = ['ontologies', 'classes', 'branches', 'valueSets'] as const;
export type ConstraintKind = (typeof CONSTRAINT_KINDS)[number];

/**
 * Apply one constraint of the given kind to a controlled-term field builder.
 *
 * `index` varies the term so a combination carrying two ontologies is
 * distinguishable from one carrying the same ontology twice.
 */
export const addConstraint = (builder: any, kind: ConstraintKind, index = 0): any => {
  switch (kind) {
    case 'ontologies':
      return builder.addOntology(
        new ControlledTermOntologyBuilder()
          .withAcronym(`ONT${index}`)
          .withName(`Ontology ${index}`)
          .withNumTerms(1000 + index)
          .withUri(new Iri(`https://data.bioontology.org/ontologies/ONT${index}`))
          .build(),
      );
    case 'classes':
      return builder.addClass(
        new ControlledTermClassBuilder()
          .withLabel(`Class ${index}`)
          .withPrefLabel(`Preferred Class ${index}`)
          .withSource(`SRC${index}`)
          .withType(BioportalTermType.ONTOLOGY_CLASS)
          .withUri(new Iri(`http://purl.bioontology.org/ontology/SRC/C${index}`))
          .build(),
      );
    case 'branches':
      return builder.addBranch(
        new ControlledTermBranchBuilder()
          .withAcronym(`BR${index}`)
          .withName(`Branch ${index}`)
          .withSource(`BRSRC${index}`)
          .withMaxDepth(index + 1)
          .withUri(new Iri(`http://purl.org/branch/B${index}`))
          .build(),
      );
    case 'valueSets':
      return builder.addValueSet(
        new ControlledTermValueSetBuilder()
          .withName(`Value Set ${index}`)
          .withNumTerms(50 + index)
          .withVsCollection(`VSC${index}`)
          .withUri(new Iri(`https://purl.humanatlas.io/vocab/vs#VS_${index}`))
          .build(),
      );
  }
};

export interface ConstraintCombination {
  label: string;
  kinds: ConstraintKind[];
  /** How many of each kind to add, keyed by kind. */
  counts: Record<string, number>;
}

/**
 * Every non-empty subset of the four constraint kinds — 15 combinations.
 *
 * Enumerated by bitmask rather than hand-listed so it stays exhaustive if a
 * fifth constraint kind is ever added to CONSTRAINT_KINDS.
 */
export const CONSTRAINT_COMBINATIONS: ConstraintCombination[] = (() => {
  const out: ConstraintCombination[] = [];
  const n = CONSTRAINT_KINDS.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const kinds = CONSTRAINT_KINDS.filter((_, i) => mask & (1 << i));
    out.push({
      label: kinds.join('+'),
      kinds: [...kinds],
      counts: Object.fromEntries(kinds.map((k) => [k, 1])),
    });
  }
  return out;
})();

/**
 * Combinations that carry more than one constraint of a kind.
 *
 * Multiplicity is a separate axis from presence: CEE copies each list wholesale
 * into `ControlledInfo`, so a list that is truncated or deduplicated somewhere
 * in the pipeline only shows up when there is more than one entry.
 */
export const MULTIPLICITY_COMBINATIONS: ConstraintCombination[] = [
  { label: 'ontologies×3', kinds: ['ontologies'], counts: { ontologies: 3 } },
  { label: 'classes×3', kinds: ['classes'], counts: { classes: 3 } },
  { label: 'branches×2', kinds: ['branches'], counts: { branches: 2 } },
  { label: 'valueSets×2', kinds: ['valueSets'], counts: { valueSets: 2 } },
  {
    label: 'all4×2',
    kinds: [...CONSTRAINT_KINDS],
    counts: { ontologies: 2, classes: 2, branches: 2, valueSets: 2 },
  },
];

/** Builder configuration hook applying a whole combination. */
export const configureFor =
  (combo: ConstraintCombination) =>
  (builder: any): any => {
    let b = builder;
    for (const kind of combo.kinds) {
      const count = combo.counts[kind] ?? 1;
      for (let i = 0; i < count; i++) {
        b = addConstraint(b, kind, i);
      }
    }
    return b;
  };
