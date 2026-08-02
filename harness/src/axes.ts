/**
 * The axes CEE's template parser actually branches on.
 *
 * This file is the reason the harness is generative rather than a corpus. A
 * pile of real-world templates has *unknown* coverage; an enumeration of the
 * decision space has coverage you can point at. Every entry below maps to a
 * concrete branch in `TemplateRepresentationFactory.wrap()` or one of the
 * handlers, cited inline.
 *
 * When CEE grows a new input type, `test/coverage.spec.ts` fails until this
 * list and the library's builder facade both catch up. That failure is the
 * feature — it is exactly the drift that produced the five uncovered types
 * currently listed in UNCOVERED_INPUT_TYPES.
 */
import { CedarBuilders, ControlledTermOntologyBuilder, Iri } from 'cedar-model-typescript-library';

/** How a value gets written into a field of this kind via HandlerContext. */
export type WriteMode = 'value' | 'controlled' | 'attribute' | 'none';

export interface FieldKind {
  /** Stable key; also used as the template property name (prefixed with `_`). */
  key: string;
  /** The `_ui.inputType` CEE should end up with. */
  inputType: string;
  /** Builder factory from the model library. */
  make: () => any;
  /** Static content fields never take a value and are not form inputs. */
  isStatic: boolean;
  /** How the driver should write into it. */
  write: WriteMode;
  /** A value valid for this field type, used by the round-trip oracle. */
  sample: string;
  /** Extra builder configuration this field type needs to be well-formed. */
  configure?: (builder: any) => any;
}

const f = (
  key: string,
  inputType: string,
  make: () => any,
  sample: string,
  write: WriteMode = 'value',
  isStatic = false,
  configure?: (builder: any) => any,
): FieldKind => ({ key, inputType, make, isStatic, write, sample, configure });

/**
 * A controlled-term field is only *controlled* once it carries a constraint.
 *
 * `TemplateRepresentationFactory.extractValueConstraints` decides the rendered
 * input type by asking `TemplateObjectUtil.hasControlledInfo()` — which checks
 * for a non-empty ontologies/valueSets/classes/branches list. Build one without
 * any of those and CEE renders it as a plain `textfield`, regardless of what
 * the builder was called. Worth knowing: it means an under-specified controlled
 * field degrades silently rather than erroring.
 */
const withOntology = (builder: any) =>
  builder.addOntology(
    new ControlledTermOntologyBuilder()
      .withAcronym('MESH')
      .withName('Medical Subject Headings')
      .withNumTerms(353825)
      .withUri(new Iri('https://data.bioontology.org/ontologies/MESH'))
      .build(),
  );

/**
 * All CEE input types reachable through the model library's builder facade.
 *
 * `list` appears twice on purpose: CEE collapses single- and multiple-choice
 * lists onto one `inputType`, but the library models them as distinct field
 * types with different deployment builders (AlwaysSingle vs AlwaysMultiple).
 * Both paths must be exercised — they produce different instance shapes.
 */
export const FIELD_KINDS: FieldKind[] = [
  f('text', 'textfield', () => CedarBuilders.textFieldBuilder(), 'some text'),
  f('textarea', 'textarea', () => CedarBuilders.textAreaBuilder(), 'a longer\nblock of text'),
  f('numeric', 'numeric', () => CedarBuilders.numericFieldBuilder(), '42'),
  f('email', 'email', () => CedarBuilders.emailFieldBuilder(), 'someone@example.org'),
  f('phone', 'phone-number', () => CedarBuilders.phoneNumberFieldBuilder(), '+1-650-555-0100'),
  f('temporal', 'temporal', () => CedarBuilders.temporalFieldBuilder(), '2026-08-01'),
  f('link', 'link', () => CedarBuilders.linkFieldBuilder(), 'https://example.org/thing'),
  f('orcid', 'ext-orcid', () => CedarBuilders.extOrcidFieldBuilder(), 'https://orcid.org/0000-0002-1825-0097'),
  f('ror', 'ext-ror', () => CedarBuilders.extRorFieldBuilder(), 'https://ror.org/00f54p054'),
  f('pfas', 'ext-pfas', () => CedarBuilders.extPfasFieldBuilder(), 'https://comptox.epa.gov/dashboard/chemical/details/DTXSID3031860'),
  f('radio', 'radio', () => CedarBuilders.radioFieldBuilder(), 'Option A'),
  f('checkbox', 'checkbox', () => CedarBuilders.checkboxFieldBuilder(), 'Option A'),
  f('listSingle', 'list', () => CedarBuilders.singleChoiceListFieldBuilder(), 'Option A'),
  f('listMulti', 'list', () => CedarBuilders.multipleChoiceListFieldBuilder(), 'Option A'),
  f('controlled', 'controlled', () => CedarBuilders.controlledTermFieldBuilder(), 'Homo sapiens', 'controlled', false, withOntology),
  f('attrValue', 'attribute-value', () => CedarBuilders.attributeValueFieldBuilder(), 'attr value', 'attribute'),
  // Static content — rendered, never valued. Exercises the collapse logic.
  f('image', 'image', () => CedarBuilders.imageFieldBuilder(), '', 'none', true),
  f('youtube', 'youtube', () => CedarBuilders.youtubeFieldBuilder(), '', 'none', true),
  f('richText', 'richtext', () => CedarBuilders.richTextFieldBuilder(), '', 'none', true),
  f('sectionBreak', 'section-break', () => CedarBuilders.sectionBreakFieldBuilder(), '', 'none', true),
  f('pageBreak', 'page-break', () => CedarBuilders.pageBreakFieldBuilder(), '', 'none', true),
];

/**
 * CEE input types with no builder in the model library's facade.
 *
 * These four landed on CEE `develop` with their lookup services (PubMed, RRID,
 * NIH Grant, DOI) but have no counterpart in the model library at all — no
 * directory under `model/cedar/field/dynamic/`, so nothing to expose.
 *
 * `ext-pfas` used to be on this list. Its eight files already existed and were
 * registered in the readers, the writers and `index.ts`; only the
 * `CedarBuilders` facade method was missing, so it could be read and written
 * but never authored. That is now fixed upstream and it is covered above.
 *
 * The remaining four are shaped like ExtOrcid/ExtRor, so closing the gap is
 * mechanical but not small: eight files each plus six registration points.
 * Until then, this list is asserted against CEE's `InputType` so the harness
 * reports the gap honestly instead of quietly testing 20 of 24 types.
 */
export const UNCOVERED_INPUT_TYPES: readonly string[] = [
  'ext-pubmed',
  'ext-rrid',
  'ext-nih-grant-id',
  'ext-doi',
] as const;

/** Cardinality axis — `type: 'object'` vs `type: 'array'` in the template. */
export const CARDINALITIES = ['single', 'multi'] as const;
export type Cardinality = (typeof CARDINALITIES)[number];

/**
 * Nesting axis. Each position resolves paths differently in
 * `DataObjectStructureHandler.getDataPathNodeRecursively` — the multi-element
 * case is the one that consults `currentIndex`, so it is the only position
 * where path resolution is order-dependent.
 */
export const NESTINGS = ['root', 'inElement', 'inMultiElement'] as const;
export type Nesting = (typeof NESTINGS)[number];
