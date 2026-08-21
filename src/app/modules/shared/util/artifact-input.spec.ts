import { vi } from 'vitest';
import controlledTemplate from '../../../../../visual/fixtures/04-controlled-terms.json';
import controlledInstance from '../../../../../visual/fixtures/04-controlled-terms-instance.json';
import type { CeeJsonObject, CeeTemplateAndInstance } from '../../../cee-public-api';
import { MessageHandlerService } from '../service/message-handler.service';
import { DataContext } from './data-context';
import { ArtifactInputCoordinator } from './artifact-input-coordinator';

const template = controlledTemplate as unknown as CeeJsonObject;
const instance = controlledInstance as unknown as CeeJsonObject;

const make = () => {
  const error = vi.fn();
  const coordinator = new ArtifactInputCoordinator({ error } as unknown as MessageHandlerService);
  return { coordinator, error };
};

describe('ArtifactInputCoordinator', () => {
  it('publishes a complete template state in one transaction', () => {
    const { coordinator, error } = make();

    expect(coordinator.acceptTemplate(template)).toBe(true);

    expect(coordinator.state.templateJson).toBe(template);
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

    expect(coordinator.state.templateJson).toBe(template);
    expect(coordinator.state.instanceJson).toBe(instance);
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
    expect(coordinator.state.templateAndInstanceJson).toBe(combined);
    expect(coordinator.state.dataContext.templateRepresentation).not.toBeNull();
    expect(coordinator.state.handlerContext.instanceSupplied).toBe(true);
    expect(coordinator.state.revision).toBe(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('does not publish or spend a claim when template parsing fails', () => {
    const { coordinator, error } = make();
    const initial = coordinator.state;

    expect(coordinator.acceptTemplate({})).toBe(false);
    expect(coordinator.state).toBe(initial);
    expect(coordinator.state.revision).toBe(0);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('not a readable CEDAR template'));

    expect(coordinator.acceptTemplate(template)).toBe(true);
    expect(coordinator.state.templateJson).toBe(template);
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
    expect(coordinator.state.instanceJson).toBe(instance);
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
