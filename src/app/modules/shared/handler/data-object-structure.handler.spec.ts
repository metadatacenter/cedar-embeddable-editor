/**
 * Adding, copying and deleting an occurrence when the instance is not shaped the
 * way the template says it should be.
 *
 * An instance need not carry a slot for every property its template declares.
 * `performItemAdd` says so and opens a list; the note above it records that
 * asserting the shape instead — `currentNodeAny as []` — threw on a node that
 * was not a list. Its two siblings kept that assertion, so the same input that
 * `add` was fixed for still reached `.splice` on a null.
 */
import { InstanceDataContainer, TemplateInstance } from 'cedar-model-typescript-library';
import { describe, expect, it } from 'vitest';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InputType } from '../models/input-type.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { DataContext } from '../util/data-context';
import { MessageHandlerService } from '../service/message-handler.service';
import { DataObjectStructureHandler } from './data-object-structure.handler';
import { MultiInstanceObjectHandler } from './multi-instance-object.handler';

interface Fixture {
  handler: DataObjectStructureHandler;
  dataContext: DataContext;
  field: MultiFieldComponent;
  multi: MultiInstanceObjectHandler;
  root: InstanceDataContainer;
  errors: string[];
}

/** A template declaring one repeating field, over an instance that omits it. */
const sparseInstance = (): Fixture => {
  const field = new MultiFieldComponent();
  field.name = 'authors';
  field.path = ['authors'];
  field.basicInfo.inputType = InputType.text;
  field.multiInfo.minItems = 1;

  const template = new CedarTemplate();
  template.children = [field];

  const root = new InstanceDataContainer();

  const dataContext = new DataContext();
  dataContext.templateRepresentation = template;
  dataContext.instanceFullData = { dataContainer: root } as unknown as TemplateInstance;

  const multi = new MultiInstanceObjectHandler();
  multi.setInstanceResolver(() => root.values['authors'] ?? null);
  multi.buildNewOrFromMetadata(template, root);

  const errors: string[] = [];
  const messages = new MessageHandlerService();
  messages.injectEventHandler({ error: (label: string) => errors.push(label) });

  return { handler: new DataObjectStructureHandler(undefined, messages), dataContext, field, multi, root, errors };
};

describe('a repeating field the instance does not carry', () => {
  it('opens a list to add the first occurrence into', () => {
    const { handler, dataContext, field, multi, root } = sparseInstance();

    handler.multiInstanceItemAdd(dataContext, field, multi);

    expect(Array.isArray(root.values['authors'])).toBe(true);
  });

  it('refuses to copy rather than throwing', () => {
    const { handler, dataContext, field, multi, errors } = sparseInstance();

    expect(() => handler.multiInstanceItemCopy(dataContext, field, multi)).not.toThrow();
    expect(errors).toHaveLength(1);
  });

  it('refuses to delete rather than throwing', () => {
    const { handler, dataContext, field, multi, errors } = sparseInstance();

    expect(() => handler.multiInstanceItemDelete(dataContext, field, multi)).not.toThrow();
    expect(errors).toHaveLength(1);
  });

  it('copies an occurrence the instance does carry', () => {
    const { handler, dataContext, field, multi, root, errors } = sparseInstance();
    handler.multiInstanceItemAdd(dataContext, field, multi);

    handler.multiInstanceItemCopy(dataContext, field, multi);

    expect((root.values['authors'] as unknown[]).length).toBe(2);
    expect(errors).toEqual([]);
  });

  it('deletes an occurrence the instance does carry', () => {
    const { handler, dataContext, field, multi, root, errors } = sparseInstance();
    handler.multiInstanceItemAdd(dataContext, field, multi);

    handler.multiInstanceItemDelete(dataContext, field, multi);

    expect((root.values['authors'] as unknown[]).length).toBe(0);
    expect(errors).toEqual([]);
  });
});
