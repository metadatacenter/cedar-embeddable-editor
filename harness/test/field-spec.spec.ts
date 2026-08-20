/**
 * What a field's specification states, and what it deliberately leaves out.
 *
 * The cases are the ones a read-only form renders as an empty box: a pattern nothing had ever read,
 * a temporal granularity that looks identical in every date picker, an ontology branch an
 * autocomplete only names once someone types into it, and an enumeration only a dropdown reveals.
 * Constraint counts quoted here come from the 51 HuBMAP assay templates, 1,416 fields.
 */
import { describe, expect, it } from 'vitest';
import { SingleFieldComponent } from '@cee/models/field/single-field-component.model';
import { MultiFieldComponent } from '@cee/models/field/multi-field-component.model';
import { ChoiceOption } from '@cee/models/info/choice-option.model';
import { FieldComponent } from '@cee/models/component/field-component.model';
import { InputType } from '@cee/models/input-type.model';
import {
  SpecFact,
  SpecFactKey,
  specCardinalityFactsOf,
  specDefaultFactsOf,
  specDefaultTermOf,
  specOptionsOf,
  specTermSourcesOf,
  specUnitFactsOf,
  specValueFactsOf,
} from '@cee/util/field-spec';

const textField = (): FieldComponent => {
  const field = new SingleFieldComponent();
  field.basicInfo.inputType = InputType.text;
  return field;
};

const keysOf = (field: FieldComponent): string[] => specValueFactsOf(field).map((fact: SpecFact) => fact.key);
const cardinalityKeysOf = (field: FieldComponent): string[] =>
  specCardinalityFactsOf(field).map((fact: SpecFact) => fact.key);

describe('what a text field states', () => {
  it('states the pattern, which 193 fields declare and nothing had ever shown', () => {
    const field = textField();
    field.valueInfo.regex = '^(?:\\.|\\./.+|\\w.*)$';

    const facts = specValueFactsOf(field);
    expect(facts).toStrictEqual([{ key: SpecFactKey.pattern, params: { regex: '^(?:\\.|\\./.+|\\w.*)$' } }]);
  });

  it('states each length bound only when the template declares it', () => {
    const field = textField();
    field.valueInfo.maxLength = 200;

    expect(keysOf(field)).toStrictEqual([SpecFactKey.maxLength]);
  });

  it('states nothing at all for an unconstrained field, so no empty block appears', () => {
    expect(specValueFactsOf(textField())).toStrictEqual([]);
  });
});

describe('what a numeric field states', () => {
  it('states its type and range, keeping the type beside the bounds it constrains', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.numeric;
    field.numberInfo.numberType = 'xsd:int';
    field.numberInfo.unitOfMeasure = 'cycle';
    field.numberInfo.minValue = 1;
    field.numberInfo.maxValue = 40;

    expect(keysOf(field)).toStrictEqual([SpecFactKey.numberType, SpecFactKey.minValue, SpecFactKey.maxValue]);
  });

  it('keeps the unit out of that list, to be stated last on the line', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.numeric;
    field.numberInfo.unitOfMeasure = 'mm';

    expect(specUnitFactsOf(field)).toStrictEqual([{ key: SpecFactKey.unitOfMeasure, params: { unitOfMeasure: 'mm' } }]);
    expect(keysOf(field)).toStrictEqual([]);
  });
});

describe('what a temporal field states', () => {
  // The notation is a fact like any other again: the read-only box renders the facts, so there is no
  // picker with its own `HH` and `MM` boxes to defer to.
  const temporal = (granularity: string, type: string): FieldComponent => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.temporal;
    field.basicInfo.temporalGranularity = granularity;
    field.valueInfo.temporalType = type;
    return field;
  };

  it('states the shape of an acceptable value, which is what a date picker cannot show', () => {
    expect(keysOf(temporal('day', 'xsd:date'))).toStrictEqual([SpecFactKey.notationDay]);
  });

  it('caps the date at the granularity rather than showing a fuller shape than is recorded', () => {
    expect(keysOf(temporal('year', 'xsd:date'))).toStrictEqual([SpecFactKey.notationYear]);
  });

  it('states a time-only field as a time, with no date part', () => {
    expect(keysOf(temporal('minute', 'xsd:time'))).toStrictEqual([SpecFactKey.notationMinute]);
  });

  it('states both halves for a date and time', () => {
    expect(keysOf(temporal('decimalSecond', 'xsd:dateTime'))).toStrictEqual([
      SpecFactKey.notationDay,
      SpecFactKey.notationDecimalSecond,
    ]);
  });

  it('states the clock and the required zone once a time is recorded', () => {
    const field = temporal('minute', 'xsd:time');
    field.basicInfo.inputTimeFormat = '12h';
    field.basicInfo.timezoneEnabled = true;

    expect(keysOf(field)).toStrictEqual([
      SpecFactKey.notationMinute,
      SpecFactKey.temporalTimeFormat,
      SpecFactKey.temporalZoneRequired,
    ]);
  });

  it('says nothing about a clock or a zone on a date, where neither can apply', () => {
    const field = temporal('day', 'xsd:date');
    field.basicInfo.inputTimeFormat = '24h';
    field.basicInfo.timezoneEnabled = true;

    expect(keysOf(field)).toStrictEqual([SpecFactKey.notationDay]);
  });

  it('says nothing about a zone that is not required, since its absence is the default', () => {
    expect(keysOf(temporal('minute', 'xsd:time'))).toStrictEqual([SpecFactKey.notationMinute]);
  });
});

describe('how many occurrences a field takes', () => {
  it('states the bounds for a repeating field', () => {
    const field = new MultiFieldComponent();
    field.basicInfo.inputType = InputType.text;
    field.multiInfo.minItems = 1;
    field.multiInfo.maxItems = 5;

    expect(specCardinalityFactsOf(field)).toStrictEqual([{ key: SpecFactKey.cardinality, params: { min: 1, max: 5 } }]);
  });

  it('says "or more" rather than inventing an upper bound the template omits', () => {
    const field = new MultiFieldComponent();
    field.basicInfo.inputType = InputType.text;
    field.multiInfo.minItems = 2;

    expect(specCardinalityFactsOf(field)).toStrictEqual([
      { key: SpecFactKey.cardinalityUnbounded, params: { min: 2 } },
    ]);
  });

  it('says nothing for a single-occurrence field rather than "1 to 1"', () => {
    expect(cardinalityKeysOf(textField())).toStrictEqual([]);
  });
});

describe('what an enumerating field states', () => {
  it('lists the values of a dropdown, which shows one of them at a time', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.list;
    field.choiceInfo.choices = [
      new ChoiceOption('Red', false),
      new ChoiceOption('Green', true),
      new ChoiceOption('Blue', false),
    ];

    expect(specOptionsOf(field).map((option) => option.label)).toStrictEqual(['Red', 'Green', 'Blue']);
  });

  it('lists nothing for a radio group, which already draws every option', () => {
    // Restating what the control shows is worse than omitting it: it teaches a reader to skip the
    // block. The values are only worth stating where the widget hides them.
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.radio;
    field.choiceInfo.choices = [new ChoiceOption('Alpha', false), new ChoiceOption('Beta', true)];

    expect(specOptionsOf(field)).toStrictEqual([]);
  });

  it('lists nothing for a checkbox group, for the same reason', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.checkbox;
    field.choiceInfo.choices = [new ChoiceOption('One', true)];

    expect(specOptionsOf(field)).toStrictEqual([]);
  });

  it('lists nothing for a field whose values are not enumerated', () => {
    const field = textField();
    field.choiceInfo.choices = [new ChoiceOption('leaked', false)];

    expect(specOptionsOf(field)).toStrictEqual([]);
  });
});

describe('what a controlled-term field states', () => {
  it('names the authority, narrowest first', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.ontologies = [
      { uri: 'http://data.bioontology.org/ontologies/DOID', acronym: 'DOID', name: 'Human Disease' },
    ];
    field.controlledInfo.branches = [
      {
        uri: 'http://purl.obolibrary.org/obo/DOID_4',
        acronym: 'DOID',
        name: 'disease',
        source: 'Human Disease Ontology',
        maxDepth: 0,
      },
    ];

    expect(specTermSourcesOf(field)).toStrictEqual([
      {
        kind: 'branch',
        name: 'disease',
        // Spelled out, because the acronym is an abbreviation and a reader may not know it.
        container: 'Human Disease Ontology',
        acronym: 'DOID',
        uri: 'http://purl.obolibrary.org/obo/DOID_4',
      },
      {
        kind: 'ontology',
        name: 'Human Disease',
        container: null,
        acronym: 'DOID',
        uri: 'http://data.bioontology.org/ontologies/DOID',
      },
    ]);
  });

  it('falls back to the identifier when a constraint names nothing, rather than showing a blank', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.valueSets = [{ uri: 'https://example.org/vs/1' }];

    expect(specTermSourcesOf(field)).toStrictEqual([
      {
        kind: 'valueSet',
        name: 'https://example.org/vs/1',
        container: null,
        acronym: null,
        uri: 'https://example.org/vs/1',
      },
    ]);
  });

  it('does not repeat an acronym a spelled-out name already carries', () => {
    // Real templates write a branch's source both ways. "Medical Subject Headings (MESH)" plus an
    // appended "(MESH)" is what this prevents.
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.branches = [
      {
        uri: 'http://purl.bioontology.org/ontology/MESH/D005796',
        acronym: 'MESH',
        name: 'Genes',
        source: 'Medical Subject Headings (MESH)',
      },
    ];

    expect(specTermSourcesOf(field)).toStrictEqual([
      {
        kind: 'branch',
        name: 'Genes',
        container: 'Medical Subject Headings (MESH)',
        acronym: null,
        uri: 'http://purl.bioontology.org/ontology/MESH/D005796',
      },
    ]);
  });

  it('drops an ontology name that is only the word "undefined", as the HuBMAP corpus carries', () => {
    // 497 of 504 branch constraints there hold "undefined (HRAVS)" — a JavaScript undefined written
    // into the name by whatever produced the templates. Showing it would repeat that bug at a reader.
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.branches = [
      {
        uri: 'https://purl.humanatlas.io/vocab/hravs#HRAVS_1000361',
        acronym: 'HRAVS',
        name: 'Dataset type',
        source: 'undefined (HRAVS)',
        maxDepth: 0,
      },
    ];

    expect(specTermSourcesOf(field)).toStrictEqual([
      {
        kind: 'branch',
        name: 'Dataset type',
        container: null,
        acronym: 'HRAVS',
        uri: 'https://purl.humanatlas.io/vocab/hravs#HRAVS_1000361',
      },
    ]);
  });

  it('names a class by its acronym rather than treating it as a spelled-out ontology', () => {
    // `source` on a class is "DOID", not "Human Disease Ontology", so reading it as the container
    // produced "class asthma of the DOID".
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.classes = [
      { uri: 'http://purl.obolibrary.org/obo/DOID_2841', prefLabel: 'asthma', source: 'DOID' },
    ];

    expect(specTermSourcesOf(field)).toStrictEqual([
      {
        kind: 'class',
        name: 'asthma',
        container: null,
        acronym: 'DOID',
        uri: 'http://purl.obolibrary.org/obo/DOID_2841',
      },
    ]);
  });

  it('names no sources for a field that is not controlled', () => {
    expect(specTermSourcesOf(textField())).toStrictEqual([]);
  });
});

describe('a declared default', () => {
  it('is named beside the field rather than left sitting in the control unlabelled', () => {
    const field = textField();
    field.valueInfo.defaultValue = 'TEST001-RK';

    expect(specDefaultFactsOf(field)).toStrictEqual([
      { key: SpecFactKey.defaultValue, params: { defaultValue: 'TEST001-RK' } },
    ]);
    expect(specValueFactsOf(field)).toStrictEqual([]);
  });

  it('is left to the permitted-values list for an enumeration, which marks its own', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.list;
    field.choiceInfo.choices = [new ChoiceOption('Red', false), new ChoiceOption('Green', true)];

    expect(specValueFactsOf(field)).toStrictEqual([]);
    expect(
      specOptionsOf(field)
        .filter((option) => option.selectedByDefault)
        .map((option) => option.label),
    ).toStrictEqual(['Green']);
  });
});

/*
 * The cases a template reaches only occasionally, each of which the derivation answers differently
 * from the common one beside it. Grouped rather than scattered because what they have in common is
 * being the second half of a decision the tests above only exercise one half of.
 */
describe('the less-travelled halves', () => {
  it('states a lower length bound as its own fact', () => {
    const field = textField();
    field.valueInfo.minLength = 3;

    expect(specValueFactsOf(field)).toStrictEqual([{ key: SpecFactKey.minLength, params: { minLength: 3 } }]);
  });

  it('says "one decimal place" rather than "1 decimal places"', () => {
    const single = new SingleFieldComponent();
    single.basicInfo.inputType = InputType.numeric;
    single.numberInfo.decimalPlace = 1;
    const several = new SingleFieldComponent();
    several.basicInfo.inputType = InputType.numeric;
    several.numberInfo.decimalPlace = 3;

    expect(specValueFactsOf(single)).toStrictEqual([{ key: SpecFactKey.decimalPlaceOne, params: {} }]);
    expect(specValueFactsOf(several)).toStrictEqual([{ key: SpecFactKey.decimalPlaces, params: { decimalPlace: 3 } }]);
  });

  it('states nothing for a temporal field whose granularity the template omits', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.temporal;

    expect(specValueFactsOf(field)).toStrictEqual([]);
  });

  it('states a boolean default as the word the instance records', () => {
    const field = textField();
    field.valueInfo.defaultValue = false;

    expect(specDefaultFactsOf(field)).toStrictEqual([
      { key: SpecFactKey.defaultValue, params: { defaultValue: 'false' } },
    ]);
  });

  it('leaves a term default to the term, which can be linked, and states it as a fact for nothing else', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.valueInfo.defaultValue = { iri: 'http://purl.obolibrary.org/obo/DOID_2841', label: 'asthma' };

    expect(specDefaultFactsOf(field)).toStrictEqual([]);
    expect(specDefaultTermOf(field)).toStrictEqual({
      label: 'asthma',
      uri: 'http://purl.obolibrary.org/obo/DOID_2841',
    });
  });

  it('has no term to offer when the default is text', () => {
    const field = textField();
    field.valueInfo.defaultValue = 'TEST001-RK';

    expect(specDefaultTermOf(field)).toBeNull();
  });

  it('states no default for an enumeration where no option is marked', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.list;
    field.choiceInfo.choices = [new ChoiceOption('Red', false), new ChoiceOption('Green', false)];

    expect(specDefaultFactsOf(field)).toStrictEqual([]);
  });

  it('states no unit for a number that declares none', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.numeric;

    expect(specUnitFactsOf(field)).toStrictEqual([]);
  });

  it('falls back to the address when an authority carries no name', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.ontologies = [{ uri: 'https://data.bioontology.org/ontologies/DOID' }];
    field.controlledInfo.valueSets = [{ uri: 'https://cadsr.nci.nih.gov/vs/Grade' }];
    field.controlledInfo.classes = [{ uri: 'http://purl.obolibrary.org/obo/DOID_2841' }];
    field.controlledInfo.branches = [{ uri: 'http://purl.obolibrary.org/obo/DOID_4' }];

    expect(
      specTermSourcesOf(field).map((source) => [source.kind, source.name, source.container, source.acronym]),
    ).toStrictEqual([
      ['branch', 'http://purl.obolibrary.org/obo/DOID_4', null, null],
      ['ontology', 'https://data.bioontology.org/ontologies/DOID', null, null],
      ['valueSet', 'https://cadsr.nci.nih.gov/vs/Grade', null, null],
      ['class', 'http://purl.obolibrary.org/obo/DOID_2841', null, null],
    ]);
  });

  it('prefers a class label when it carries no preferred one', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.classes = [{ uri: 'http://purl.obolibrary.org/obo/DOID_2841', label: 'asthma' }];

    expect(specTermSourcesOf(field)[0].name).toBe('asthma');
  });

  it('spells out a container name that does not carry its own acronym', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.branches = [
      {
        uri: 'http://purl.obolibrary.org/obo/DOID_4',
        name: 'disease',
        source: 'Human Disease Ontology',
        acronym: 'DOID',
      },
    ];

    const source = specTermSourcesOf(field)[0];
    expect(source.container).toBe('Human Disease Ontology');
    expect(source.acronym, 'the acronym is stated separately when the name does not include it').toBe('DOID');
  });

  it('names no container when the constraint records an empty source', () => {
    const field = new SingleFieldComponent();
    field.basicInfo.inputType = InputType.controlled;
    field.controlledInfo.branches = [{ uri: 'http://purl.obolibrary.org/obo/DOID_4', name: 'disease', source: '' }];

    expect(specTermSourcesOf(field)[0].container).toBeNull();
  });
});
