import { afterNextRender, AfterRenderRef, Injectable, Injector, OnDestroy } from '@angular/core';

interface PendingRender {
  generation: number;
  ref: AfterRenderRef;
  resolve: (ran: boolean) => void;
}

/**
 * The one place CEE waits for Angular to turn state into live widgets.
 *
 * A new transition supersedes the previous one. This matters when several host
 * inputs arrive in one turn, or when a user pages faster than Angular renders:
 * only the newest state may be pushed through the live-component registry.
 */
@Injectable()
export class RenderSchedulerService implements OnDestroy {
  private generation = 0;
  private pending: PendingRender | null = null;
  private destroyed = false;

  constructor(private readonly injector: Injector) {}

  /** Run `task` after Angular's next completed render; resolve false if superseded. */
  schedule(task: () => void): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }

    this.cancelPending();
    const generation = ++this.generation;

    return new Promise<boolean>((resolve, reject) => {
      const pending: PendingRender = {
        generation,
        ref: afterNextRender(
          () => {
            if (this.destroyed || this.pending !== pending || generation !== this.generation) {
              resolve(false);
              return;
            }
            this.pending = null;
            try {
              task();
              resolve(true);
            } catch (error) {
              reject(error);
            }
          },
          { injector: this.injector },
        ),
        resolve,
      };
      this.pending = pending;
    });
  }

  /** Invalidate work queued against an older component tree. */
  cancel(): void {
    ++this.generation;
    this.cancelPending();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancel();
  }

  private cancelPending(): void {
    const pending = this.pending;
    if (pending === null) {
      return;
    }
    this.pending = null;
    pending.ref.destroy();
    pending.resolve(false);
  }
}
