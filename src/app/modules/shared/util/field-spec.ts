import { FieldComponent } from '../models/component/field-component.model';
import { ChoiceOption } from '../models/info/choice-option.model';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { isAuthorityTerm } from '../models/authority/authority-term.guard';
import {
  BranchConstraint,
  ClassConstraint,
  OntologyConstraint,
  ValueSetConstraint,
} from '../models/info/controlled-info.model';

/**
 * What a field demands of a value, as facts rather than as a widget.
 *
 * A widget says where to type. Read-only with no instance behind it, that is all it says: an empty
 * box carries no information, and for a temporal or controlled-term field it carries the wrong
 * information, because a date picker looks identical whether the template asks for a year or a
 * decimal second, and an autocomplete with no value never names the ontology it would search.
 *
 * The facts are already in CEE's field model, spread across the info objects the parser fills in —
 * `basicInfo` for the temporal settings, `valueInfo` for the pattern and the lengths, `numberInfo`,
 * `choiceInfo`, `controlledInfo`, `multiInfo` for the occurrence bounds. Two of them were never read
 * by anything: `valueInfo.regex`, which 193 fields declare across the HuBMAP assay templates, and
 * `numberInfo.unitOfMeasure`. This gathers them for a reader.
 *
 * Each fact is a translation key with its parameters, not a formatted string, so the presentation
 * stays in the template and the wording stays translatable.
 *
 * A declared default is not among these. It is stated separately, by `specDefaultFactsOf`, and shown
 * beside the field's name rather than in its box — because the widget has already put it *in* the
 * box, where "Green" reads as a choice somebody made and nothing says otherwise.
 */

/** The translation keys a fact can carry. Named so a typo is a compile error rather than a blank. */
export const SpecFactKey = {
  decimalPlaces: 'Spec.DecimalPlaces',
  decimalPlaceOne: 'Spec.DecimalPlaceOne',
  defaultValue: 'Spec.DefaultValue',
  maxLength: 'Spec.MaxLength',
  maxValue: 'Spec.MaxValue',
  minLength: 'Spec.MinLength',
  minValue: 'Spec.MinValue',
  numberType: 'Spec.NumberType',
  pattern: 'Spec.Pattern',
  notationYear: 'Spec.Notation.year',
  notationMonth: 'Spec.Notation.month',
  notationDay: 'Spec.Notation.day',
  notationHour: 'Spec.Notation.hour',
  notationMinute: 'Spec.Notation.minute',
  notationSecond: 'Spec.Notation.second',
  notationDecimalSecond: 'Spec.Notation.decimalSecond',
  temporalTimeFormat: 'Spec.TemporalTimeFormat',
  temporalZoneRequired: 'Spec.TemporalZoneRequired',
  unitOfMeasure: 'Spec.UnitOfMeasure',
} as const;

export type SpecFactKeyValue = (typeof SpecFactKey)[keyof typeof SpecFactKey];

export type SpecFact = {
  readonly key: SpecFactKeyValue;
  readonly params: Readonly<Record<string, string | number>>;
};

/**
 * The word a fact leads with, for the facts that lead with one.
 *
 * A specification reads `min 12 chars · pattern ^HBM… · default HBM386.ZGKG.235`, and those lead-in
 * words are signposts rather than values — so they are set in italics, which means they have to be
 * marked up rather than baked into the fact's own string. The split lives here, beside the facts, so
 * the three surfaces that state a fact agree: the heading row, the box that replaces an empty
 * control, and the placeholder inside a control that has one. It used to live in the box's template
 * and covered four of the seven, so `pattern` and `default` read as values of themselves and the
 * heading row italicized nothing at all.
 *
 * A fact with no entry is a phrase rather than a labelled value — `YYYY-MM-DD`, `time zone
 * required`, `2 decimal places` — and has nothing to set apart.
 */
const SPEC_FACT_KEYWORD: Partial<Record<SpecFactKeyValue, string>> = {
  [SpecFactKey.minLength]: 'Spec.Keyword.Min',
  [SpecFactKey.maxLength]: 'Spec.Keyword.Max',
  [SpecFactKey.minValue]: 'Spec.Keyword.Min',
  [SpecFactKey.maxValue]: 'Spec.Keyword.Max',
  [SpecFactKey.unitOfMeasure]: 'Spec.Keyword.Unit',
  [SpecFactKey.pattern]: 'Spec.Keyword.Pattern',
  [SpecFactKey.defaultValue]: 'Spec.Keyword.Default',
};

/** The translation key of a fact's lead-in word, or null where the fact leads with none. */
export function specKeywordOf(fact: SpecFact): string | null {
  return SPEC_FACT_KEYWORD[fact.key] ?? null;
}

/** One authority a controlled-term field draws its values from. */
export type SpecTermSource = {
  /** `branch`, `ontology`, `valueSet`, `class` or `value`, which decides how narrow the authority is. */
  readonly kind: 'branch' | 'ontology' | 'valueSet' | 'class' | 'value';
  /** What the authority is called: a branch's label, an ontology's or value set's full name. */
  readonly name: string;
  /**
   * What holds it, for a branch or a class: the ontology's own name, spelled out. A reader who does
   * not already know that DOID is the Human Disease Ontology learns nothing from the acronym alone.
   */
  readonly container: string | null;
  /** The acronym or value-set collection, shown in parentheses after the name it abbreviates. */
  readonly acronym: string | null;
  readonly uri: string | null;
};

const fact = (key: SpecFactKeyValue, params: Record<string, string | number> = {}): SpecFact => ({ key, params });

function textFacts(field: FieldComponent): SpecFact[] {
  const facts: SpecFact[] = [];
  const { minLength, maxLength, regex } = field.valueInfo;
  if (minLength !== null) {
    facts.push(fact(SpecFactKey.minLength, { minLength }));
  }
  if (maxLength !== null) {
    facts.push(fact(SpecFactKey.maxLength, { maxLength }));
  }
  if (regex !== null) {
    facts.push(fact(SpecFactKey.pattern, { regex }));
  }
  return facts;
}

function numericFacts(field: FieldComponent): SpecFact[] {
  const facts: SpecFact[] = [];
  // The unit is not among these. It reads last on the line, whatever else the field says, so it is
  // stated separately by `specUnitFactsOf` and appended after everything — see that function.
  const { numberType, minValue, maxValue, decimalPlace } = field.numberInfo;
  if (numberType !== null) {
    facts.push(fact(SpecFactKey.numberType, { numberType }));
  }
  if (minValue !== null) {
    facts.push(fact(SpecFactKey.minValue, { minValue }));
  }
  if (maxValue !== null) {
    facts.push(fact(SpecFactKey.maxValue, { maxValue }));
  }
  if (decimalPlace !== null) {
    // Singular and plural as separate keys rather than a formatted count: the interpolation cannot
    // choose between them, and "1 decimal places" is the kind of thing a reader notices.
    facts.push(
      decimalPlace === 1 ? fact(SpecFactKey.decimalPlaceOne) : fact(SpecFactKey.decimalPlaces, { decimalPlace }),
    );
  }
  return facts;
}

/**
 * A temporal field stated as the shape of an acceptable value — `YYYY-MM-DD` — rather than as the
 * setting that produces it. "to the day" named the granularity correctly and told a reader nothing:
 * the notation is the same fact in the form they will actually write.
 *
 * Two halves, because the type decides whether a date is recorded and the granularity decides how
 * far the time goes. Spelling out every combination as one string would be twenty-one translations
 * of the same two ideas.
 */
const DATE_NOTATION: Readonly<Record<string, SpecFactKeyValue>> = {
  year: SpecFactKey.notationYear,
  month: SpecFactKey.notationMonth,
  day: SpecFactKey.notationDay,
};

const TIME_NOTATION: Readonly<Record<string, SpecFactKeyValue>> = {
  hour: SpecFactKey.notationHour,
  minute: SpecFactKey.notationMinute,
  second: SpecFactKey.notationSecond,
  decimalSecond: SpecFactKey.notationDecimalSecond,
};

/**
 * The granularity is the whole specification of a temporal field, and it is the fact a form cannot
 * show: the same controls appear whether the template asks for a day or a decimal second.
 *
 * The clock format and the time zone are stated only when a time is actually recorded. A date to the
 * day has no clock to be twelve-hour and no zone to require, so saying either would state a setting
 * that cannot apply — which is how a specification stops being read.
 */
function temporalFacts(field: FieldComponent): SpecFact[] {
  const facts: SpecFact[] = [];
  const { temporalGranularity, inputTimeFormat, timezoneEnabled } = field.basicInfo;
  const temporalType = field.valueInfo.temporalType;
  if (temporalGranularity === null) {
    return facts;
  }

  // A time-only field records no date, whatever its granularity; anything else does. The granularity
  // caps the date part, so a year-granularity field is `YYYY` and not a truncated `YYYY-MM-DD`.
  const recordsDate = temporalType !== 'xsd:time';
  const recordsTime = TIME_NOTATION[temporalGranularity] !== undefined && temporalType !== 'xsd:date';

  if (recordsDate) {
    facts.push(fact(DATE_NOTATION[temporalGranularity] ?? SpecFactKey.notationDay));
  }
  if (recordsTime) {
    facts.push(fact(TIME_NOTATION[temporalGranularity]));
    if (inputTimeFormat !== null) {
      facts.push(fact(SpecFactKey.temporalTimeFormat, { inputTimeFormat }));
    }
    if (timezoneEnabled) {
      facts.push(fact(SpecFactKey.temporalZoneRequired));
    }
  }
  return facts;
}

/**
 * The facts that occupy the field-name row in read-only rendering.
 *
 * Most widgets carry their specification in their own placeholder, so putting the same facts beside
 * the name would say them twice. Radio and checkbox groups have no placeholder, and an
 * attribute-value field has two boxes whose placeholders name the pair rather than its constraints;
 * those are the fields whose facts remain on the header row.
 *
 * Kept here rather than in the component that renders the facts because layout also needs to know
 * whether that row is occupied: a repeating field can share an empty row with its occurrence chips,
 * but must give a row carrying facts its full width.
 */
export function specHeaderFactsOf(field: FieldComponent): ReadonlyArray<SpecFact> {
  const inputType = field.basicInfo.inputType;
  const controlStatesSpecification =
    inputType === InputType.text ||
    inputType === InputType.textarea ||
    inputType === InputType.numeric ||
    inputType === InputType.email ||
    inputType === InputType.link ||
    inputType === InputType.phoneNumber ||
    inputType === InputType.controlled ||
    inputType === InputType.list ||
    inputType === InputType.temporal ||
    EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType as InputType);

  if (controlStatesSpecification) {
    return [];
  }

  const optionsCarryDefault = inputType === InputType.radio || inputType === InputType.checkbox;
  return [
    ...(optionsCarryDefault ? [] : specDefaultFactsOf(field)),
    ...specValueFactsOf(field),
    ...specUnitFactsOf(field),
  ];
}

/**
 * The value the template supplies when nobody chooses one, whatever shape it takes.
 *
 * Every kind is covered because every kind shows it the same way: the widget puts it in the control.
 * A list arrives pre-selected, a radio pre-checked, a term field pre-filled — and read-only none of
 * them can be told from a choice somebody made, which is the fact this states.
 */
export function specDefaultFactsOf(field: FieldComponent): SpecFact[] {
  const declared = field.valueInfo.defaultValue;
  if (typeof declared === 'string' && declared.length > 0) {
    return [fact(SpecFactKey.defaultValue, { defaultValue: declared })];
  }
  if (typeof declared === 'number' || typeof declared === 'boolean') {
    return [fact(SpecFactKey.defaultValue, { defaultValue: String(declared) })];
  }
  if (isAuthorityTerm(declared)) {
    // A term default is stated by `specDefaultTermOf` instead: it has an identifier and can therefore
    // be a link, which is the same reason the authorities are not facts either.
    return [];
  }
  // An enumeration declares its default by marking one of its own options, and it is stated the same
  // way as every other default: named once, at the front, rather than marked inline in the list of
  // values. "default Green · Values Red, Green, Blue" reads as one fact then the set it comes from;
  // marking the list instead made a reader hunt for a parenthesis to learn the same thing.
  const chosen = field.choiceInfo.choices.find((option) => option.selectedByDefault);
  return chosen === undefined ? [] : [fact(SpecFactKey.defaultValue, { defaultValue: chosen.label })];
}

/**
 * What an acceptable value looks like. Stated inside the control, where the value itself would be:
 * an empty box in read-only says nothing, and this is the one thing that belongs in that space.
 */
export function specValueFactsOf(field: FieldComponent): SpecFact[] {
  const inputType = field.basicInfo.inputType;
  const facts: SpecFact[] = [];

  switch (inputType) {
    case InputType.text:
    case InputType.textarea:
      facts.push(...textFacts(field));
      break;
    case InputType.numeric:
      facts.push(...numericFacts(field));
      break;
    case InputType.temporal:
      facts.push(...temporalFacts(field));
      break;
    default:
      // Every other kind states its constraint through its permissible values or its term sources,
      // which are listed separately, or through its type alone — a link, an email, an ORCID.
      break;
  }

  return facts;
}

/**
 * The permissible values of a field whose control conceals them.
 *
 * Only the list widgets qualify. A radio group and a checkbox group draw every option on screen, so
 * stating them again says nothing a reader cannot already see — and a specification that repeats the
 * form is worse than one that omits it, because it teaches the reader to skip the block. A closed
 * dropdown shows one value out of however many, which is where the enumeration is the only place the
 * rest of them appear.
 */
export function specOptionsOf(field: FieldComponent): ReadonlyArray<ChoiceOption> {
  return field.basicInfo.inputType === InputType.list ? field.choiceInfo.choices : [];
}

/**
 * Whether a spelled-out name already carries its own acronym.
 *
 * A branch's `source` is a display name rather than a key, and across the corpus it is written both
 * ways: `"Human Disease Ontology"`, and `"Medical Subject Headings (MESH)"`. Appending the acronym to
 * the second form gives "Medical Subject Headings (MESH) (MESH)".
 */
/**
 * The ontology's spelled-out name from a branch's `source`, or null when it holds none.
 *
 * `source` is a display name rather than a key, and templates write it three ways. Sometimes the name
 * alone, `"Human Disease Ontology"`. Sometimes the name with its acronym, `"Medical Subject Headings
 * (MESH)"`, which is why the acronym is not appended again — that gave "(MESH) (MESH)".
 *
 * And sometimes no name at all: 497 of the 504 branch constraints across the HuBMAP corpus carry the
 * literal `"undefined (HRAVS)"`, a JavaScript `undefined` written in by whatever produced them. There
 * is nothing to spell out there, so the acronym stands alone — CEE showing "of the undefined" would
 * be repeating somebody else's bug at the reader.
 */
const spelledOutName = (source: string | undefined, acronym: string | undefined): string | null => {
  if (source === undefined || source === '') {
    return null;
  }
  const withoutAcronym = acronym === undefined ? source : source.replace(`(${acronym})`, '');
  const name = withoutAcronym.trim();
  return name === '' || name === 'undefined' ? null : source;
};

const branchSource = (branch: BranchConstraint): SpecTermSource => {
  const container = spelledOutName(branch.source, branch.acronym);
  const namesItsOwnAcronym =
    container !== null && branch.acronym !== undefined && container.includes(`(${branch.acronym})`);
  return {
    kind: 'branch',
    name: branch.name ?? branch.uri ?? '',
    container,
    acronym: namesItsOwnAcronym ? null : branch.acronym ?? null,
    uri: branch.uri ?? null,
  };
};

const ontologySource = (ontology: OntologyConstraint): SpecTermSource => ({
  kind: 'ontology',
  name: ontology.name ?? ontology.uri ?? '',
  container: null,
  acronym: ontology.acronym ?? null,
  uri: ontology.uri ?? null,
});

const valueSetSource = (valueSet: ValueSetConstraint): SpecTermSource => ({
  kind: 'valueSet',
  name: valueSet.name ?? valueSet.uri ?? '',
  container: null,
  acronym: valueSet.vsCollection ?? null,
  uri: valueSet.uri ?? null,
});

const classSource = (entry: ClassConstraint): SpecTermSource => ({
  // Some producers use the classes array for a fixed value. Preserve that distinction in the label
  // while treating an absent type as the ontology class shape the model names.
  kind: entry.type === 'Value' ? 'value' : 'class',
  name: entry.prefLabel ?? entry.label ?? entry.uri ?? '',
  // A class names its ontology by acronym in `source`, where a branch names it in full. Reading it as
  // a container produced "class asthma of the DOID": an acronym in the slot for a spelled-out name.
  container: null,
  acronym: entry.source ?? null,
  uri: entry.uri ?? null,
});

/**
 * Where a controlled-term field takes its values from, narrowest authority first: a branch names a
 * subtree, an ontology the whole of one, a value set a curated list, a class a single term.
 */
export function specTermSourcesOf(field: FieldComponent): ReadonlyArray<SpecTermSource> {
  if (field.basicInfo.inputType !== InputType.controlled) {
    return [];
  }
  const controlled = field.controlledInfo;
  return [
    ...controlled.branches.map(branchSource),
    ...controlled.ontologies.map(ontologySource),
    ...controlled.valueSets.map(valueSetSource),
    ...controlled.classes.map(classSource),
  ];
}

/**
 * A controlled field's declared default, as a term rather than as text.
 *
 * Separate from the other defaults because this one identifies something: a reader who wants to know
 * what "asthma" means can be shown, and a fact rendered as a string cannot carry the link. Null for
 * every other kind of default, whose value is text and has nowhere to point.
 */
export function specDefaultTermOf(field: FieldComponent): { readonly label: string; readonly uri: string } | null {
  const declared = field.valueInfo.defaultValue;
  return isAuthorityTerm(declared) ? { label: declared.label, uri: declared.iri } : null;
}

/**
 * The unit a value is measured in, stated last on the line.
 *
 * Last because it qualifies the whole value rather than constraining it: `xsd:decimal · min 1 ·
 * 3 decimal places` are rules a value must satisfy, and `unit mm` says what the number then means.
 * Read in the middle it separated the type from its bounds, which belong together.
 */
export function specUnitFactsOf(field: FieldComponent): SpecFact[] {
  const unit = field.numberInfo.unitOfMeasure;
  return unit === null ? [] : [fact(SpecFactKey.unitOfMeasure, { unitOfMeasure: unit })];
}
