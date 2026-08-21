/**
 * The host's event handler.
 *
 * `eventHandler` is a documented `@Input` on the web component. Until now its value was
 * stored in `MessageHandlerService` and read nowhere at all, so a host page passing one
 * received nothing — a public input that did nothing, which is indistinguishable from
 * one that works until someone depends on it.
 *
 * What it should emit was never written down. The narrow reading is taken instead: the
 * value was routed into the service whose job is diagnostics and lifecycle notification,
 * so a handler hears `trace`, `error`, and one `ready`. These tests pin that contract,
 * including the parts a host will actually hit — a partial handler, deduplication, and a
 * handler that throws.
 */
import { describe, expect, it, vi } from 'vitest';
import { MessageHandlerService } from '../../src/app/modules/shared/service/message-handler.service';

/** Keep the console quiet; the service logs everything it emits. */
const silence = () => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
};

describe('the injected event handler', () => {
  it('receives traces and errors', () => {
    silence();
    const seen: Array<[string, string, unknown]> = [];
    const service = new MessageHandlerService();
    service.injectEventHandler({
      trace: (label: string, value: unknown) => seen.push(['trace', label, value]),
      error: (label: string, value: unknown) => seen.push(['error', label, value]),
    });

    service.trace('a trace');
    service.error('an error');

    expect(seen).toEqual([
      ['trace', 'a trace', null],
      ['error', 'an error', null],
    ]);
  });

  it('passes the object through for the object-carrying variants', () => {
    silence();
    const seen: Array<[string, unknown]> = [];
    const service = new MessageHandlerService();
    service.injectEventHandler({
      trace: (label: string, value: unknown) => seen.push([label, value]),
      error: (label: string, value: unknown) => seen.push([label, value]),
    });

    const payload = { why: 'diagnostics' };
    service.traceObject('with an object', payload);
    service.errorObject('failed', payload);

    expect(seen).toEqual([
      ['with an object', payload],
      ['failed', payload],
    ]);
  });

  it('emits ready once for the element, however many render paths complete', () => {
    silence();
    const ready = vi.fn();
    const service = new MessageHandlerService();
    service.injectEventHandler({ ready });

    service.ready();
    service.ready();

    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('does not replay ready to a handler attached after rendering', () => {
    silence();
    const ready = vi.fn();
    const service = new MessageHandlerService();

    service.ready();
    service.injectEventHandler({ ready });
    service.ready();

    expect(ready).not.toHaveBeenCalled();
  });

  /**
   * The handler slot is replaceable, which the published contract once denied of it
   * while the setter replaced silently anyway. Two things are pinned here: the new
   * handler receives, and the swap is announced to it — the displaced handler simply
   * going quiet is otherwise the only evidence a page gets.
   */
  it('replaces a handler already installed, and tells the new one', () => {
    silence();
    const first: string[] = [];
    const second: string[] = [];
    const service = new MessageHandlerService();

    service.injectEventHandler({ trace: (label: string) => first.push(label) });
    service.trace('before the swap');
    service.injectEventHandler({ trace: (label: string) => second.push(label) });
    service.trace('after the swap');

    expect(first).toEqual(['before the swap']);
    expect(second).toEqual([
      'CEDAR Embeddable Editor: "eventHandler" replaced; this handler receives from now on.',
      'after the swap',
    ]);
  });

  it('says nothing about a replacement when there was no handler to replace', () => {
    silence();
    const seen: string[] = [];
    const service = new MessageHandlerService();

    service.injectEventHandler({ trace: (label: string) => seen.push(label) });

    expect(seen).toEqual([]);
  });

  it('flattens a trace group into one label', () => {
    silence();
    const seen: string[] = [];
    const service = new MessageHandlerService();
    service.injectEventHandler({ trace: (label: string) => seen.push(label) });

    service.traceGroup('group', 'the message');

    expect(seen).toEqual(['group : the message']);
  });

  /**
   * A handler with only the method it cares about is the common case — a host that wants
   * errors should not have to stub `trace` to avoid a crash.
   */
  it('tolerates a handler that implements only some of the methods', () => {
    silence();
    const errors: string[] = [];
    const service = new MessageHandlerService();
    service.injectEventHandler({ error: (label: string) => errors.push(label) });

    expect(() => service.trace('ignored')).not.toThrow();
    service.error('heard');

    expect(errors).toEqual(['heard']);
  });

  it('does nothing when no handler was injected, and does not throw', () => {
    silence();
    const service = new MessageHandlerService();
    expect(() => {
      service.trace('t');
      service.error('e');
      service.traceObject('t', {});
      service.errorObject('e', {});
      service.ready();
    }).not.toThrow();
  });

  /**
   * The important one. A handler is the host's code running inside CEE's call stack —
   * during an instance read, or while a quality report is being built. If a throw
   * propagated, a host's logging bug would surface as CEE failing to load a document.
   */
  it('survives a handler that throws, and says so on the console', () => {
    silence();
    const service = new MessageHandlerService();
    service.injectEventHandler({
      trace: () => {
        throw new Error('the host is broken');
      },
    });

    expect(() => service.trace('still fine')).not.toThrow();
    expect(console.error).toHaveBeenCalledWith('CEE ERROR: the injected eventHandler threw from trace()');
  });

  it('contains a host exception from ready too', () => {
    silence();
    const service = new MessageHandlerService();
    service.injectEventHandler({
      ready: () => {
        throw new Error('the host is broken');
      },
    });

    expect(() => service.ready()).not.toThrow();
    expect(console.error).toHaveBeenCalledWith('CEE ERROR: the injected eventHandler threw from ready()');
  });

  it('still logs to the console when a handler is attached', () => {
    silence();
    const service = new MessageHandlerService();
    service.injectEventHandler({ trace: () => undefined, error: () => undefined });

    service.trace('a trace');
    service.error('an error');

    // Attaching a handler must not silence the console: existing debugging keeps working.
    expect(console.log).toHaveBeenCalledWith('CEE TRACE: a trace');
    expect(console.error).toHaveBeenCalledWith('CEE ERROR: an error');
  });
});
