import { OverlayRef, ScrollStrategy } from '@angular/cdk/overlay';

/**
 * Keep an overlay with its anchor when anything on the page scrolls.
 *
 * Material's own scroll strategies cannot do this for CEE, and the reason is worth
 * stating because it is not a fault in either library.
 *
 * `RepositionScrollStrategy` subscribes to `ScrollDispatcher.ancestorScrolled`,
 * which narrows scroll events to the *registered* scrollable ancestors of the
 * overlay's origin. A container is registered by the `cdkScrollable` directive, and
 * the container CEE scrolls inside belongs to the embedding application: in the
 * Template Designer it is `section.template-container` in `create-instance.html`, a
 * plain `overflow-y: auto` element in a template CEE does not own. So it is not an
 * ancestor the dispatcher knows, the filter drops every event, and the overlay never
 * moves.
 *
 * `CloseScrollStrategy` looks like it should work, because it listens to `scrolled()`
 * — every scroll rather than an ancestor's. It does not, for a subtler reason:
 * `scrolled()` installs a single listener, on `document`, in the bubble phase, and a
 * `scroll` event on an element does not bubble. A document-level bubble listener
 * hears the document scrolling and nothing else.
 *
 * Measured in the Template Designer with a suggestion panel open: the field moved
 * from y=470 to y=6 while the panel stayed at y=506, ending over unrelated fields.
 * `window.scrollY` stayed 0 throughout — the window never scrolled — while
 * `section.template-container.scrollTop` reached 400.
 *
 * A capture-phase listener on `document` does see it, because capture runs from the
 * document down to the target whether or not the event bubbles. That is the whole
 * mechanism here.
 *
 * It repositions rather than closing. Closing is the easier answer and is what a
 * native `select` does, but the panel is anchored to a field the user is still
 * filling in, and the position is recomputed from the origin's own rect, so
 * following it is both correct and cheap. What happens when the field scrolls out of
 * view is Material's flexible position strategy's business, not this class's — it
 * already decides where an overlay goes when its origin leaves the viewport, and
 * duplicating that judgement here would mean guessing at which element the origin is
 * from an `OverlayRef` that is not told.
 */
export class RepositionOnAnyScrollStrategy implements ScrollStrategy {
  private overlayRef: OverlayRef | null = null;
  private listening = false;

  /**
   * `document`, not the shadow root: a scroll inside CEE and a scroll in the
   * embedding page both have to reach this, and the shadow boundary does not stop
   * capture from reaching a target inside it.
   */
  constructor(private readonly documentRef: Document) {}

  private readonly onScroll = (event: Event): void => {
    const overlayRef = this.overlayRef;
    if (!overlayRef?.hasAttached()) {
      return;
    }
    /*
     * A scroll inside the panel is not the page moving under it. Without this,
     * scrolling a long suggestion list repositions the list while it is being read.
     */
    const target = event.target;
    if (target instanceof Node && overlayRef.overlayElement.contains(target)) {
      return;
    }
    overlayRef.updatePosition();
  };

  attach(overlayRef: OverlayRef): void {
    this.overlayRef = overlayRef;
  }

  enable(): void {
    if (this.listening) {
      return;
    }
    this.listening = true;
    this.documentRef.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
  }

  disable(): void {
    if (!this.listening) {
      return;
    }
    this.listening = false;
    this.documentRef.removeEventListener('scroll', this.onScroll, { capture: true });
  }

  detach(): void {
    this.disable();
    this.overlayRef = null;
  }
}
