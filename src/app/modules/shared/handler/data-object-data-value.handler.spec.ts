/**
 * What an *edited* field records once it is emptied again.
 *
 * `data-object-builder.handler.spec.ts` asks the same question of a field nobody
 * has touched. Both have to hold, and only the build side was ever checked — so
 * the one shape that reaches the instance through an edit and never through a
 * build went unnoticed.
 */
import {
  InstanceDataAttributeValueFieldName,
  InstanceDataContainer,
  TemplateInstance,
} from 'cedar-model-typescript-library';
import { describe, expect, it } from 'vitest';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InputType } from '../models/input-type.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { DataContext } from '../util/data-context';
import { InstanceValueNode } from '../util/instance-value-node';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';
import { DataObjectDataValueHandler } from './data-object-data-value.handler';
import { MessageHandlerService } from '../service/message-handler.service';

interface Fixture {
  handler: DataObjectDataValueHandler;
  dataContext: DataContext;
  field: MultiFieldComponent;
  multi: MultiInstanceObjectHandler;
  root: InstanceDataContainer;
}

/** A template of one attribute-value field, and an instance holding one named slot. */
const attributeValueFixture = (): Fixture => {
  const field = new MultiFieldComponent();
  field.name = 'extras';
  field.path = ['extras'];
  field.basicInfo.inputType = InputType.attributeValue;

  const template = new CedarTemplate();
  template.children = [field];

  const root = new InstanceDataContainer();
  root.setValue('extras', [new InstanceDataAttributeValueFieldName('colour')]);
  root.setValue('colour', InstanceValueNode.literalValue('blue'));

  const dataContext = new DataContext();
  dataContext.templateRepresentation = template;
  dataContext.instanceFullData = { dataContainer: root } as unknown as TemplateInstance;

  const multi = new MultiInstanceObjectHandler();
  multi.buildNewOrFromMetadata(template, root);

  return { handler: new DataObjectDataValueHandler(new MessageHandlerService()), dataContext, field, multi, root };
};

describe('what an emptied attribute value records', () => {
  it('records an empty slot when the box is cleared by deleting its text', () => {
    // The guard meant to fold this in read `if (value && value.length === 0)`,
    // and `''` is falsy, so it never ran. The empty string reached the instance
    // and was written out as `{"@value": ""}` — a shape no other field produces,
    // and one a consumer testing for null reads as an answer.
    const { handler, dataContext, field, multi, root } = attributeValueFixture();

    handler.changeAttributeValue(dataContext, field, multi, 'colour', '');

    expect(InstanceValueNode.literal(root.values['colour'])).toBeNull();
  });

  it('records the same empty slot however the box was cleared', () => {
    const typedAway = attributeValueFixture();
    typedAway.handler.changeAttributeValue(typedAway.dataContext, typedAway.field, typedAway.multi, 'colour', '');

    const cleared = attributeValueFixture();
    cleared.handler.changeAttributeValue(cleared.dataContext, cleared.field, cleared.multi, 'colour', null);

    expect(InstanceValueNode.literal(typedAway.root.values['colour'])).toBe(
      InstanceValueNode.literal(cleared.root.values['colour']),
    );
  });

  it('still records a value the user actually typed', () => {
    const { handler, dataContext, field, multi, root } = attributeValueFixture();

    handler.changeAttributeValue(dataContext, field, multi, 'colour', 'green');

    expect(InstanceValueNode.literal(root.values['colour'])).toBe('green');
  });

  it('keeps a zero, which is a value rather than an absence', () => {
    const { handler, dataContext, field, multi, root } = attributeValueFixture();

    handler.changeAttributeValue(dataContext, field, multi, 'colour', '0');

    expect(InstanceValueNode.literal(root.values['colour'])).toBe('0');
  });
});
