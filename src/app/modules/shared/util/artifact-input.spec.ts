import { vi } from 'vitest';
import controlledTemplate from '../../../../../visual/fixtures/04-controlled-terms.json';
import controlledInstance from '../../../../../visual/fixtures/04-controlled-terms-instance.json';
import type { CeeJsonObject, CeeTemplateAndInstance } from '../../../cee-public-api';
import { MessageHandlerService } from '../service/message-handler.service';
import { DataContext } from './data-context';
import { InstanceSerializer } from './instance-serializer';
import { downloadContentFor } from './download-content';
import { ArtifactInputCoordinator } from './artifact-input-coordinator';
import { InstanceDeserializer } from './instance-deserializer';
import * as carriedAnswers from './carried-answers';

const template = controlledTemplate as unknown as CeeJsonObject;
const instance = controlledInstance as unknown as CeeJsonObject;

const make = () => {
  const error = vi.fn();
  const coordinator = new ArtifactInputCoordinator({
    error,
    trace: vi.fn(),
    warning: vi.fn(),
  } as unknown as MessageHandlerService);
  return { coordinator, error };
};

describe('ArtifactInputCoordinator', () => {
  it('publishes a complete template state in one transaction', () => {
    const { coordinator, error } = make();

    expect(coordinator.acceptTemplate(template)).toBe(true);

    expect(coordinator.state.templateJson).toEqual(template);
    expect(coordinator.state.dataContext.templateRepresentation).not.toBeNull();
    expect(coordinator.state.handlerContext.dataContext).toBe(coordinator.state.dataContext);
    expect(coordinator.state.handlerContext.instanceSupplied).toBe(false);
    expect(coordinator.state.revision).toBe(1);
    expect(error).not.toHaveBeenCalled();
  });

  it.each([
    ['instance then template', ['instance', 'template']],
    ['template then instance', ['template', 'instance']],
  ] as const)('accepts %s without exposing a half-built editor', (_name, order) => {
    const { coordinator, error } = make();

    for (const input of order) {
      expect(input === 'template' ? coordinator.acceptTemplate(template) : coordinator.acceptInstance(instance)).toBe(
        true,
      );
    }

    expect(coordinator.state.templateJson).toEqual(template);
    expect(coordinator.state.instanceJson).toEqual(instance);
    expect(coordinator.state.dataContext.templateRepresentation).not.toBeNull();
    expect(coordinator.state.handlerContext.instanceSupplied).toBe(true);
    expect(coordinator.state.revision).toBe(2);
    expect(error).not.toHaveBeenCalled();
  });

  it('builds a later template against a fresh instance candidate', () => {
    const { coordinator } = make();

    expect(coordinator.acceptInstance(instance)).toBe(true);
    const waiting = coordinator.state.dataContext.instanceFullData;
    expect(coordinator.acceptTemplate(template)).toBe(true);

    expect(coordinator.state.dataContext.instanceFullData).not.toBe(waiting);
  });

  it('accepts the combined input as one revision and parses the template once', () => {
    const { coordinator, error } = make();
    const combined: CeeTemplateAndInstance = { templateObject: template, instanceObject: instance };
    const parse = vi.spyOn(DataContext.prototype, 'setInputTemplate');

    expect(coordinator.acceptCombined(combined)).toBe(true);

    expect(parse).toHaveBeenCalledTimes(1);
    expect(coordinator.state.templateAndInstanceJson).toEqual(combined);
    expect(coordinator.state.dataContext.templateRepresentation).not.toBeNull();
    expect(coordinator.state.handlerContext.instanceSupplied).toBe(true);
    expect(coordinator.state.revision).toBe(1);
    expect(error).not.toHaveBeenCalled();
  });

  it.each([{}, instance, { properties: null }, { properties: [] }, { properties: 'invalid' }])(
    'does not publish or spend a claim when template parsing fails: %j',
    (invalid) => {
      const { coordinator, error } = make();
      const initial = coordinator.state;

      expect(coordinator.acceptTemplate(invalid as CeeJsonObject)).toBe(false);
      expect(coordinator.state).toBe(initial);
      expect(coordinator.state.revision).toBe(0);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('not a readable CEDAR template'));

      expect(coordinator.acceptTemplate(template)).toBe(true);
      expect(coordinator.state.templateJson).toEqual(template);
      expect(coordinator.state.revision).toBe(1);
    },
  );

  it('accepts an empty schema container despite missing legacy blueprint metadata', () => {
    const { coordinator } = make();
    expect(coordinator.acceptTemplate({ properties: {} })).toBe(true);
    expect(coordinator.state.revision).toBe(1);
  });

  it('does not publish or spend a claim when instance parsing fails', () => {
    const { coordinator, error } = make();

    expect(coordinator.acceptInstance({ '@id': {} })).toBe(false);
    expect(coordinator.instanceInputRejected).toBe(true);
    expect(coordinator.state.instanceJson).toBeNull();
    expect(coordinator.state.revision).toBe(0);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('not a readable CEDAR instance'));

    expect(coordinator.acceptInstance(instance)).toBe(true);
    expect(coordinator.instanceInputRejected).toBe(false);
    expect(coordinator.state.instanceJson).toEqual(instance);
  });

  it('rejects a mixed combined input without replacing either accepted artifact', () => {
    const { coordinator, error } = make();

    expect(coordinator.acceptTemplate(template)).toBe(true);
    const accepted = coordinator.state;
    expect(coordinator.acceptCombined({ templateObject: template, instanceObject: instance })).toBe(false);

    expect(coordinator.state).toBe(accepted);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('template is already set'));
  });

  it.each([
    [{ templateObject: null, instanceObject: instance }, 'Template Object is missing.'],
    [{ templateObject: template, instanceObject: [] }, 'Instance Object is missing.'],
  ] as const)('leaves both combined claims reusable when a member is missing', (invalid, message) => {
    const { coordinator, error } = make();

    expect(coordinator.acceptCombined(invalid as unknown as CeeTemplateAndInstance)).toBe(false);
    expect(error).toHaveBeenCalledWith(message);

    expect(coordinator.acceptCombined({ templateObject: template, instanceObject: instance })).toBe(true);
  });
});

describe('accepted artifacts belong to the coordinator', () => {
  it.each(['template', 'instance', 'combined'] as const)(
    'isolates %s input before and after pairing',
    async (first) => {
      const { coordinator } = make();
      const sourceTemplate = structuredClone(template);
      const sourceInstance = structuredClone(instance);
      if (first === 'combined') {
        expect(coordinator.acceptCombined({ templateObject: sourceTemplate, instanceObject: sourceInstance })).toBe(
          true,
        );
      } else if (first === 'template') {
        expect(coordinator.acceptTemplate(sourceTemplate)).toBe(true);
      } else {
        expect(coordinator.acceptInstance(sourceInstance)).toBe(true);
      }
      sourceTemplate['schema:name'] = 'Host changed the template';
      sourceInstance['_organism'] = { '@id': 'urn:host-overwrite' };
      if (first === 'template') expect(coordinator.acceptInstance(instance)).toBe(true);
      if (first === 'instance') expect(coordinator.acceptTemplate(template)).toBe(true);
      const written = InstanceSerializer.toJson(coordinator.state.dataContext.instanceFullData) as CeeJsonObject;
      expect(written['_organism']).toEqual(instance['_organism']);
      const downloaded = JSON.parse(await downloadContentFor('templateSource', coordinator.state.dataContext));
      expect(downloaded['schema:name']).toBe(template['schema:name']);
    },
  );

  it.each(['template', 'instance', 'combined'] as const)(
    'does not consume a %s claim when a host object cannot be cloned',
    (kind) => {
      const { coordinator, error } = make();
      const uncloneable = { callback: () => {} } as unknown as CeeJsonObject;
      const accepted =
        kind === 'template'
          ? coordinator.acceptTemplate(uncloneable)
          : kind === 'instance'
            ? coordinator.acceptInstance(uncloneable)
            : coordinator.acceptCombined({ templateObject: template, instanceObject: uncloneable });
      expect(accepted).toBe(false);
      expect(coordinator.state.revision).toBe(0);
      expect(error).toHaveBeenCalled();
      expect(coordinator.acceptCombined({ templateObject: template, instanceObject: instance })).toBe(true);
    },
  );
});

describe('host transactions under unexpected dependency failures', () => {
  it('retains the waiting instance if rereading it fails, and permits retry', () => {
    const { coordinator } = make();
    expect(coordinator.acceptInstance(instance)).toBe(true);
    const waiting = coordinator.state;
    vi.spyOn(InstanceDeserializer, 'read').mockImplementationOnce(() => {
      throw 'read failed';
    });
    expect(coordinator.acceptTemplate(template)).toBe(false);
    expect(coordinator.state).toBe(waiting);
    expect(coordinator.acceptTemplate(template)).toBe(true);
  });

  it('retains the preview if pairing an instance fails halfway through initialization', () => {
    const { coordinator } = make();
    expect(coordinator.acceptTemplate(template)).toBe(true);
    const previous = coordinator.state;
    vi.spyOn(DataContext.prototype, 'setInputTemplate').mockImplementationOnce(() => {
      throw 'initialization failed';
    });
    expect(coordinator.acceptInstance(instance)).toBe(false);
    expect(coordinator.state).toBe(previous);
    expect(coordinator.instanceInputRejected).toBe(true);
    expect(coordinator.acceptInstance(instance)).toBe(true);
    expect(coordinator.instanceInputRejected).toBe(false);
  });

  it.each([false, new Error('unexpected carry failure'), 'unexpected carry failure'])(
    'publishes a fresh form if carrying cannot complete: %s',
    (failure) => {
      const { coordinator } = make();
      expect(coordinator.acceptTemplate(template)).toBe(true);
      const previous = coordinator.state;
      vi.spyOn(carriedAnswers, 'carryAnswers').mockImplementationOnce(() => {
        if (failure === false) return false;
        throw failure;
      });
      expect(coordinator.acceptTemplate(template)).toBe(true);
      expect(coordinator.state.revision).toBe(previous.revision + 1);
      expect(coordinator.state.dataContext).not.toBe(previous.dataContext);
      expect(InstanceSerializer.toJson(coordinator.state.dataContext.instanceFullData)).toEqual(
        InstanceSerializer.toJson(previous.dataContext.instanceFullData),
      );
    },
  );

  it('keeps the live form when both carrying and the fresh fallback fail', () => {
    const { coordinator } = make();
    expect(coordinator.acceptTemplate(template)).toBe(true);
    const previous = coordinator.state;
    vi.spyOn(carriedAnswers, 'carryAnswers').mockReturnValueOnce(false);
    const initialize = DataContext.prototype.setInputTemplate;
    vi.spyOn(DataContext.prototype, 'setInputTemplate')
      .mockImplementationOnce(initialize)
      .mockImplementationOnce(() => {
        throw new Error('fallback failed');
      });
    expect(coordinator.acceptTemplate(template)).toBe(false);
    expect(coordinator.state).toBe(previous);
    expect(coordinator.acceptTemplate(template)).toBe(true);
  });
});
