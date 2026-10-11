import { describe, expect, it } from 'vitest';
import type { CeeJsonObject, CeeTemplateAndInstance } from '../../../cee-public-api';
import { commands, checkHistory, historySeeds, Command } from '../../../../testing/seeded-history';
import { Reader, templateJson } from './carried-answers.testing';
import { InstanceSerializer } from './instance-serializer';

interface Reference {
  template: CeeJsonObject | null;
  instance: CeeJsonObject | null;
  combined: CeeTemplateAndInstance | null;
  revision: number;
  value: string | null;
  defaultValue: string | null;
  owned: boolean;
}
const blank = (): Reference => ({
  template: null,
  instance: null,
  combined: null,
  revision: 0,
  value: null,
  defaultValue: null,
  owned: false,
});
const TEMPLATE_ID = 'https://example.org/host-template';
const template = (value: string) =>
  templateJson([{ key: 'answer', kind: 'text', default: value }], { id: TEMPLATE_ID });
const instance = (value: string): CeeJsonObject => ({
  '@id': 'https://example.org/host-instance',
  '@context': { answer: 'https://schema.metadatacenter.org/properties/answer' },
  'schema:isBasedOn': TEMPLATE_ID,
  'schema:name': 'Host input',
  answer: { '@value': value },
});

/** The reference has only assignment claims and one literal, no production state
 * objects. It describes the host contract rather than rebuilding the coordinator. */
function replay(history: Command[]): void {
  const editors = [new Reader(), new Reader()];
  const expected = [blank(), blank()];
  const inputs: CeeJsonObject[] = [];
  for (const command of history) {
    const index = command.a % editors.length;
    let reader = editors[index];
    let model = expected[index];
    const previous = reader.coordinator.state;
    const value = `host:${command.c % 9}`;
    const nextTemplate = template(value);
    const nextInstance = instance(value);
    let accepted: boolean | undefined;
    let wanted = false;
    if (command.op === 0) {
      reader = editors[index] = new Reader();
      model = expected[index] = blank();
    } else if (command.op === 1 || command.op === 2) {
      wanted = !model.template || !model.instance;
      accepted = reader.coordinator.acceptTemplate(nextTemplate);
      if (wanted) {
        model.template = structuredClone(nextTemplate);
        if (!model.instance && !model.owned) model.value = value;
        model.defaultValue = value;
      }
    } else if (command.op === 3) {
      wanted = !model.instance;
      accepted = reader.coordinator.acceptInstance(nextInstance);
      if (wanted) {
        model.instance = structuredClone(nextInstance);
        model.value = value;
        model.owned = false;
      }
    } else if (command.op === 4) {
      wanted = !model.template && !model.instance;
      const combined = { templateObject: nextTemplate, instanceObject: nextInstance };
      accepted = reader.coordinator.acceptCombined(combined);
      if (wanted) {
        model.template = structuredClone(nextTemplate);
        model.instance = structuredClone(nextInstance);
        model.combined = structuredClone(combined);
        model.defaultValue = value;
        model.value = value;
        model.owned = false;
      }
    } else if (command.op === 5) accepted = reader.coordinator.acceptTemplate({});
    else if (command.op === 6) accepted = reader.coordinator.acceptInstance({ '@id': {} });
    else if (command.op === 7)
      accepted = reader.coordinator.acceptCombined({ templateObject: nextTemplate, instanceObject: { '@id': {} } });
    else if (command.op === 8 && model.template) {
      const text = command.b % 3 === 0 ? null : command.b % 3 === 1 ? model.defaultValue : `reader:${command.c}`;
      reader.type(['answer'], text);
      model.value = text;
      model.owned = text !== model.defaultValue;
    } else if (command.op === 9) {
      // Mutate every host-owned input, including inputs accepted before pairing.
      for (const input of inputs) {
        input['schema:name'] = 'Host overwrote source';
        input['answer'] = { '@value': 'Host overwrote value' };
        const properties = input['properties'] as CeeJsonObject | undefined;
        if (properties) properties['answer'] = {};
      }
    }
    inputs.push(nextTemplate, nextInstance);
    if (accepted !== undefined) {
      expect(accepted, 'assignment acceptance follows claims and validity').toBe(wanted);
      if (wanted) model.revision++;
      else expect(reader.coordinator.state, 'rejected input does not publish a candidate').toBe(previous);
    }
    for (const [index, editor] of editors.entries()) {
      const state = editor.coordinator.state;
      const reference = expected[index];
      expect(state.revision, 'only accepted assignments increment revision').toBe(reference.revision);
      expect(state.templateJson, 'template snapshot is owned by its editor').toEqual(
        reference.combined ? null : reference.template,
      );
      expect(state.instanceJson, 'instance snapshot is owned by its editor').toEqual(
        reference.combined ? null : reference.instance,
      );
      expect(state.templateAndInstanceJson).toEqual(reference.combined);
      expect(state.handlerContext.dataContext).toBe(state.dataContext);
      expect(state.handlerContext.instanceSupplied).toBe(reference.instance !== null);
      if (reference.template || reference.instance) {
        const written = InstanceSerializer.toJson(state.dataContext.instanceFullData) as CeeJsonObject;
        expect(written['answer'], 'current value and other editor survive host commands').toEqual({
          '@value': reference.value,
        });
      } else expect(state.dataContext.instanceFullData).toBeNull();
      expect(state.dataContext.templateRepresentation !== null).toBe(reference.template !== null);
    }
  }
}

describe('seeded host assignment histories', () => {
  it.each(historySeeds())('seed %i', (seed) => checkHistory(seed, commands(seed, 50, 10), replay));
});
