import { describe, expect, it, vi } from 'vitest';
import { OverlayRef } from '@angular/cdk/overlay';
import { RepositionOnAnyScrollStrategy } from './reposition-on-any-scroll.strategy';

/**
 * A document that records how it was listened to.
 *
 * The capture flag is the whole reason this class exists — Material's own strategies
 * listen in the bubble phase, and a `scroll` event on an element does not bubble — so
 * it is asserted rather than assumed, and the fake carries just enough of `Document`
 * to make that assertion.
 */
const fakeDocument = () => {
  const listeners: Array<{ type: string; fn: EventListener; options?: AddEventListenerOptions }> = [];
  const doc = {
    addEventListener: (type: string, fn: EventListener, options?: AddEventListenerOptions) =>
      listeners.push({ type, fn, options }),
    removeEventListener: (type: string, fn: EventListener) => {
      const at = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (at >= 0) listeners.splice(at, 1);
    },
  } as unknown as Document;
  return { doc, listeners };
};

const fakeOverlay = (overlayElement: { contains: (node: Node) => boolean }, attached = true) => {
  const updatePosition = vi.fn();
  const ref = { hasAttached: () => attached, overlayElement, updatePosition } as unknown as OverlayRef;
  return { ref, updatePosition };
};

const scrollFrom = (target: unknown) => ({ target }) as unknown as Event;

describe('the scroll strategy CEE gives its overlays', () => {
  it('listens on the document in the capture phase, which is what hears a container scroll', () => {
    const { doc, listeners } = fakeDocument();
    const strategy = new RepositionOnAnyScrollStrategy(doc);

    strategy.enable();

    expect(listeners).toHaveLength(1);
    expect(listeners[0].type).toBe('scroll');
    expect(listeners[0].options?.capture, 'a bubble-phase listener cannot hear an element scroll').toBe(true);
    expect(listeners[0].options?.passive, 'scrolling must not wait on this').toBe(true);
  });

  it('repositions the overlay when something outside it scrolls', () => {
    const { doc, listeners } = fakeDocument();
    const { ref, updatePosition } = fakeOverlay({ contains: () => false });
    const strategy = new RepositionOnAnyScrollStrategy(doc);
    strategy.attach(ref);
    strategy.enable();

    listeners[0].fn(scrollFrom(document.createElement('div')));

    expect(updatePosition).toHaveBeenCalledTimes(1);
  });

  /**
   * The panel scrolls too, and it is not the page moving under it. Without this, a
   * long suggestion list repositions itself while it is being read.
   */
  it('ignores a scroll that came from inside the overlay', () => {
    const { doc, listeners } = fakeDocument();
    const inner = document.createElement('div');
    const { ref, updatePosition } = fakeOverlay({ contains: (node) => node === inner });
    const strategy = new RepositionOnAnyScrollStrategy(doc);
    strategy.attach(ref);
    strategy.enable();

    listeners[0].fn(scrollFrom(inner));

    expect(updatePosition).not.toHaveBeenCalled();
  });

  it('does nothing once the overlay is detached', () => {
    const { doc, listeners } = fakeDocument();
    const { ref, updatePosition } = fakeOverlay({ contains: () => false }, false);
    const strategy = new RepositionOnAnyScrollStrategy(doc);
    strategy.attach(ref);
    strategy.enable();

    listeners[0].fn(scrollFrom(document.createElement('div')));

    expect(updatePosition).not.toHaveBeenCalled();
  });

  it('registers once however often it is enabled, and unregisters on disable', () => {
    const { doc, listeners } = fakeDocument();
    const strategy = new RepositionOnAnyScrollStrategy(doc);

    strategy.enable();
    strategy.enable();
    expect(listeners, 'a second enable must not add a second listener').toHaveLength(1);

    strategy.disable();
    expect(listeners).toHaveLength(0);
    strategy.disable();
    expect(listeners, 'disabling twice is not an error').toHaveLength(0);
  });

  /** `detach` is the overlay going away for good, so the listener goes with it. */
  it('stops listening and forgets the overlay on detach', () => {
    const { doc, listeners } = fakeDocument();
    const { ref, updatePosition } = fakeOverlay({ contains: () => false });
    const strategy = new RepositionOnAnyScrollStrategy(doc);
    strategy.attach(ref);
    strategy.enable();
    const fire = listeners[0].fn;

    strategy.detach();

    expect(listeners).toHaveLength(0);
    fire(scrollFrom(document.createElement('div')));
    expect(updatePosition).not.toHaveBeenCalled();
  });
});
