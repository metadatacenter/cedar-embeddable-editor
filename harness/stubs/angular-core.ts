/**
 * Minimal stand-in for `@angular/core`.
 *
 * CEE's domain layer (handlers, factory, models, utils) touches Angular in
 * exactly one way: a handful of `@Injectable()` decorations. Nothing in that
 * path needs the DI container, change detection, or zone.js — the services are
 * constructed with plain `new` by `HandlerContext`.
 *
 * Aliasing the whole package to no-op decorators keeps the harness free of
 * Angular entirely, so it neither needs Angular installed nor breaks when the
 * app is upgraded across major versions. That independence is the point: these
 * tests must stay green *through* the upgrade to be worth anything.
 */

type AnyDecorator = (...args: any[]) => any;

const noopDecoratorFactory =
  (..._factoryArgs: any[]): AnyDecorator =>
  (..._targetArgs: any[]): any =>
    undefined;

export const Injectable = noopDecoratorFactory;
export const Directive = noopDecoratorFactory;
export const Component = noopDecoratorFactory;
export const Pipe = noopDecoratorFactory;
export const NgModule = noopDecoratorFactory;
export const Input = noopDecoratorFactory;
export const Output = noopDecoratorFactory;
export const ViewChild = noopDecoratorFactory;
export const HostListener = noopDecoratorFactory;
export const Inject = noopDecoratorFactory;
export const Optional = noopDecoratorFactory;

export enum ViewEncapsulation {
  Emulated = 0,
  None = 2,
  ShadowDom = 3,
}

/**
 * Values copied from Angular, not invented.
 *
 * Only the decorator metadata reads these and the decorators here are no-ops, so
 * the harness never acts on the value — but a wrong one would still be a lie
 * sitting in a file the next person reads to learn what CEE does.
 *
 * `Eager` is Angular 22's name for what was `Default`; both are 1, and `Default`
 * is deprecated rather than gone. The rename matters more than it looks: from 22
 * a component that specifies no strategy gets OnPush, so `ng update` stamped
 * `Eager` onto all 46 of CEE's components to hold the old behaviour. CEE leans on
 * `DoCheck` and mutates model objects in place, so that migration is doing real
 * work, not tidying.
 */
export enum ChangeDetectionStrategy {
  OnPush = 0,
  Eager = 1,
  Default = 1,
}

export class EventEmitter<T = any> {
  private listeners: Array<(v: T) => void> = [];
  emit(value?: T): void {
    this.listeners.forEach((l) => l(value as T));
  }
  subscribe(next: (v: T) => void): { unsubscribe(): void } {
    this.listeners.push(next);
    return {
      unsubscribe: () => {
        this.listeners = this.listeners.filter((l) => l !== next);
      },
    };
  }
}
