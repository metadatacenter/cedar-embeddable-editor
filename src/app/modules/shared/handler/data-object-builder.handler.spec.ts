/**
 * What an empty instance records for a field nobody has answered yet.
 *
 * One state, not two: `@value: null` for a literal field and `{}` for an IRI-valued one. A choice
 * field used to be the exception — with no option selected by default it recorded the empty string,
 * which is neither, and which a consumer testing for null reads as an answer. The compact
 * serialization is where that surfaced, because it omits an empty field: of a HuBMAP assay
 * template's 53 fields it listed six, the five unanswered radios among them.
 */
import { describe, expect, it } from 'vitest';
import { InstanceDataContainer, InstanceDataTypedAtom } from 'cedar-model-typescript-library';
import { DataObjectBuilderHandler } from './data-object-builder.handler';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { ChoiceOption } from '../models/info/choice-option.model';
import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { InstanceValueNode } from '../util/instance-value-node';
import { childOf } from '../models/instance-node.model';

const built = (field: FieldComponent): InstanceDataContainer => {
  const container = new InstanceDataContainer();
  new DataObjectBuilderHandler().buildRecursively(field, container);
  return container;
};

const radioNamed = (choices: ChoiceOption[]): SingleFieldComponent => {
  const field = new SingleFieldComponent();
  field.name = 'is_technical_replicate';
  field.basicInfo.inputType = InputType.radio;
  field.choiceInfo.choices = choices;
  return field;
};

describe('what an unanswered choice field records', () => {
  it('records nothing when no option is the default', () => {
    const value = childOf(
      built(radioNamed([new ChoiceOption('Yes', false), new ChoiceOption('No', false)])),
      'is_technical_replicate',
    );

    expect(InstanceValueNode.isLiteral(value)).toBe(true);
    expect(InstanceValueNode.literal(value)).toBeNull();
  });

  it('records the default option when one is declared', () => {
    const value = childOf(
      built(radioNamed([new ChoiceOption('Yes', true), new ChoiceOption('No', false)])),
      'is_technical_replicate',
    );

    expect(InstanceValueNode.literal(value)).toBe('Yes');
  });

  it('records the last default when a template declares more than one, as it always has', () => {
    const choices = [new ChoiceOption('Yes', true), new ChoiceOption('No', true)];

    expect(InstanceValueNode.literal(childOf(built(radioNamed(choices)), 'is_technical_replicate'))).toBe('No');
  });

  it('pads a multi-occurrence choice field with empty slots, never with empty strings', () => {
    const field = new MultiFieldComponent();
    field.name = 'preparation_protocols';
    field.basicInfo.inputType = InputType.list;
    field.multiInfo.minItems = 2;
    field.choiceInfo.choices = [new ChoiceOption('A', false), new ChoiceOption('B', false)];

    const occurrences = childOf(built(field), 'preparation_protocols');

    expect(Array.isArray(occurrences)).toBe(true);
    expect((occurrences as unknown[]).length).toBe(2);
    for (const occurrence of occurrences as unknown[]) {
      expect(InstanceValueNode.literal(occurrence as never)).toBeNull();
    }
  });

  it('keeps selected defaults on an optional multi-occurrence choice field', () => {
    const field = new MultiFieldComponent();
    field.name = 'optional_protocols';
    field.basicInfo.inputType = InputType.checkbox;
    field.multiInfo.minItems = 0;
    field.choiceInfo.choices = [new ChoiceOption('A', true), new ChoiceOption('B', false)];

    const occurrences = childOf(built(field), 'optional_protocols') as unknown[];

    expect(occurrences).toHaveLength(1);
    expect(InstanceValueNode.literal(occurrences[0] as never)).toBe('A');
  });
});

describe('declared defaults in a newly built instance', () => {
  it('seeds a literal without waiting for its widget to render', () => {
    const field = new SingleFieldComponent();
    field.name = 'title';
    field.basicInfo.inputType = InputType.text;
    field.valueInfo.defaultValue = 'Untitled record';

    expect(InstanceValueNode.literal(childOf(built(field), 'title'))).toBe('Untitled record');
  });

  it('treats an empty declared string as no default', () => {
    const field = new SingleFieldComponent();
    field.name = 'title';
    field.basicInfo.inputType = InputType.text;
    field.valueInfo.defaultValue = '';

    expect(InstanceValueNode.literal(childOf(built(field), 'title'))).toBeNull();
  });

  it('seeds a controlled term as its IRI and label pair', () => {
    const field = new SingleFieldComponent();
    field.name = 'organism';
    field.basicInfo.inputType = InputType.controlled;
    field.valueInfo.defaultValue = {
      iri: 'http://purl.obolibrary.org/obo/NCBITaxon_9606',
      label: 'Homo sapiens',
    };

    const value = childOf(built(field), 'organism');
    expect(InstanceValueNode.iri(value)).toBe('http://purl.obolibrary.org/obo/NCBITaxon_9606');
    expect(InstanceValueNode.label(value)).toBe('Homo sapiens');
  });

  it('does not turn a malformed string default into a controlled term', () => {
    const field = new SingleFieldComponent();
    field.name = 'organism';
    field.basicInfo.inputType = InputType.controlled;
    field.valueInfo.defaultValue = 'Homo sapiens';

    const value = childOf(built(field), 'organism');
    expect(InstanceValueNode.iri(value)).toBeUndefined();
    expect(InstanceValueNode.literal(value)).toBeUndefined();
  });

  it('seeds an IRI-valued string as an IRI rather than a literal', () => {
    const field = new SingleFieldComponent();
    field.name = 'source';
    field.basicInfo.inputType = InputType.link;
    field.valueInfo.defaultValue = 'https://example.org/source';

    const value = childOf(built(field), 'source');
    expect(InstanceValueNode.iri(value)).toBe('https://example.org/source');
    expect(InstanceValueNode.literal(value)).toBeUndefined();
  });

  it('seeds a numeric default as a typed literal', () => {
    const field = new SingleFieldComponent();
    field.name = 'measurement';
    field.basicInfo.inputType = InputType.numeric;
    field.numberInfo.numberType = 'xsd:decimal';
    field.valueInfo.defaultValue = 42.5;

    const value = childOf(built(field), 'measurement');
    expect(InstanceValueNode.literal(value)).toBe('42.5');
    expect(value).toBeInstanceOf(InstanceDataTypedAtom);
    expect((value as InstanceDataTypedAtom).type).toBe('xsd:decimal');
  });

  it('normalizes a temporal default to the complete typed value an instance stores', () => {
    const field = new SingleFieldComponent();
    field.name = 'collected_on';
    field.basicInfo.inputType = InputType.temporal;
    field.basicInfo.temporalGranularity = 'month';
    field.valueInfo.temporalType = 'xsd:date';
    field.valueInfo.defaultValue = '2026-08';

    const value = childOf(built(field), 'collected_on');
    expect(InstanceValueNode.literal(value)).toBe('2026-08-01');
    expect(value).toBeInstanceOf(InstanceDataTypedAtom);
    expect((value as InstanceDataTypedAtom).type).toBe('xsd:date');
  });

  it('puts one literal default before the empty slots required by minItems', () => {
    const field = new MultiFieldComponent();
    field.name = 'aliases';
    field.basicInfo.inputType = InputType.text;
    field.valueInfo.defaultValue = 'Primary alias';
    field.multiInfo.minItems = 2;

    const occurrences = childOf(built(field), 'aliases') as unknown[];
    expect(occurrences).toHaveLength(2);
    expect(InstanceValueNode.literal(occurrences[0] as never)).toBe('Primary alias');
    expect(InstanceValueNode.literal(occurrences[1] as never)).toBeNull();
  });
});
