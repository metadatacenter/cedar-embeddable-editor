import { Injectable } from '@angular/core';
import { CeeEventHandler } from '../../../cee-public-api';

/**
 * Where CEE's diagnostics go.
 *
 * Everything here went to the console before and still does. What changed is that a
 * host page can now hear it: `eventHandler` was a documented `@Input` whose value was
 * stored in the private field below and **read nowhere in the codebase**, so a host
 * passing one got silence.
 *
 * The contract is inferred rather than documented, because nothing recorded it — no
 * README, no demo page, nothing in the history. What *is* known is where the value was
 * routed: into this service, whose entire job is `trace` and `error`. So the reading
 * taken here is the narrow one — a handler receives the messages this service emits,
 * under the names it already uses — rather than inventing a richer event stream
 * (value-changed, validity-changed, save-requested) that nothing asks for. Whatever is
 * emitted becomes API, so emitting less is the conservative choice, and a host wanting
 * more has somewhere obvious to extend from.
 *
 * A handler is called only if it has a matching method, so `{ error }` on its own is a
 * valid handler and will not be bothered with traces.
 */
@Injectable({
  providedIn: 'root',
})
export class MessageHandlerService {
  private eventHandler: CeeEventHandler | null = null;

  constructor() {}

  injectEventHandler(value: CeeEventHandler): void {
    this.eventHandler = value;
  }

  /**
   * Hand a message to the host's handler, if it wants this kind.
   *
   * Wrapped, because a handler is someone else's code running inside CEE's call stack:
   * a host that throws from it would otherwise take out whatever CEE was doing —
   * reading an instance, building a report — and the failure would present as a CEE
   * bug. The throw is reported on the console rather than swallowed, since a broken
   * handler is worth knowing about and this is the only place that can say so.
   */
  private emit(kind: 'trace' | 'error', label: string, value: object | null = null): void {
    const handler = this.eventHandler;
    const method = handler?.[kind];
    if (typeof method !== 'function') {
      return;
    }
    try {
      // `.call`, not `method(...)`: a handler may be a class instance whose
      // method reads `this`, and detaching it from the object would break that.
      method.call(handler, label, value);
    } catch (e) {
      console.error('CEE ERROR: the injected eventHandler threw from ' + kind + '()');
      console.error(e);
    }
  }

  trace(label: string): void {
    console.log('CEE TRACE: ' + label);
    this.emit('trace', label);
  }

  traceGroup(group: string, label: string): void {
    console.log('CEE TRACE: ' + group + ' : ' + label);
    this.emit('trace', group + ' : ' + label);
  }

  traceObject(label: string, value: object): void {
    console.log('CEE TRACE: ' + label);
    console.log(value);
    this.emit('trace', label, value);
  }

  error(label: string): void {
    console.error('CEE ERROR: ' + label);
    this.emit('error', label);
  }

  errorObject(label: string, value: object): void {
    console.error('CEE ERROR: ' + label);
    console.error(value);
    this.emit('error', label, value);
  }
}
