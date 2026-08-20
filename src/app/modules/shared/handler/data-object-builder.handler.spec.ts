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
import { InstanceDataContainer } from 'cedar-model-typescript-library';
import { DataObjectBuilderHandler } from './data-object-builder.handler';
import { DataObjectBuildingMode } from '../models/enum/data-object-building-mode.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { ChoiceOption } from '../models/info/choice-option.model';
import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { InstanceValueNode } from '../util/instance-value-node';
import { childOf } from '../models/instance-node.model';

const built = (field: FieldComponent): InstanceDataContainer => {
  const container = new InstanceDataContainer();
  new DataObjectBuilderHandler().buildRecursively(field, container, DataObjectBuildingMode.EXCLUDE_CONTEXT);
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
});
