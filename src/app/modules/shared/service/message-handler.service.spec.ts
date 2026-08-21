import { describe, expect, it, vi } from 'vitest';
import { MessageHandlerService } from './message-handler.service';

describe('MessageHandlerService value changes', () => {
  it('invokes the declared callback with a defensive path copy', () => {
    const service = new MessageHandlerService();
    const valueChanged = vi.fn();
    service.injectEventHandler({ valueChanged });
    const path = ['outer', 'field'];

    service.valueChanged(path, 'value');
    path.push('later mutation');

    expect(valueChanged).toHaveBeenCalledOnce();
    expect(valueChanged).toHaveBeenCalledWith(['outer', 'field'], 'value');
  });

  it('contains a host callback failure', () => {
    const service = new MessageHandlerService();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.injectEventHandler({
      valueChanged: () => {
        throw new Error('host failure');
      },
    });

    expect(() => service.valueChanged(['field'], 'value')).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith('CEE ERROR: the injected eventHandler threw from valueChanged()');
    consoleError.mockRestore();
  });
});
