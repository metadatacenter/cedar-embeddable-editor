import { Injectable, NgZone } from '@angular/core';
import { CedarComponent } from '../models/component/cedar-component.model';
import { HandlerContext } from '../util/handler-context';
import { componentsAlong, occurrencesOnScreen, pagesEntries } from '../util/component-location';
import { ActiveComponentRegistryService } from './active-component-registry.service';
import { PageBreakPaginatorService } from './page-break-paginator.service';
import { RenderSchedulerService } from './render-scheduler.service';

/** What `reveal` needs to know about a place on the form. */
export interface RevealLocation {
  readonly path: readonly string[];
  readonly occurrences?: readonly number[];
}

export interface RevealOptions {
  /** Whether to move keyboard focus to the field's control. Defaults to true. */
  readonly focus?: boolean;
}

/** What the reveal needs from a rendered component: where it is, and how to open it. */
export interface RevealTarget {
  readonly host: HTMLElement | null;
  /** Expand the element's panel, if the component is an element. */
  open(): void;
}

/**
 * Taking the user to a field or element, wherever it is on the form.
 *
 * A form shows one page at a time, one entry of each repeating field or element at a
 * time, and an element's fields only while its panel is open. So scrolling to a field
 * is the last of four steps: show its page, move each repeating component above it to
 * the entry that holds it, open the panels around it, and only then bring it into view.
 *
 * One per editor, beside the registry and the scheduler it works with, because each
 * of those is one per editor too.
 */
@Injectable()
export class FieldRevealService {
  private paginator: PageBreakPaginatorService | null = null;
  private readonly targets = new Map<CedarComponent, RevealTarget>();
  /**
   * The places the user has been taken to, as `path|occurrences`.
   *
   * A list too short for its `minItems` is a warning, not an error, and like an
   * unanswered requirement it stays quiet until the user is taken to it.
   */
  private readonly revealed = new Set<string>();

  constructor(
    private readonly registry: ActiveComponentRegistryService,
    private readonly renderScheduler: RenderSchedulerService,
    private readonly zone: NgZone,
  ) {}

  /** The pages of the form now on screen, which a reveal may turn. */
  usePaginator(paginator: PageBreakPaginatorService | null): void {
    this.paginator = paginator;
  }

  registerTarget(component: CedarComponent, target: RevealTarget): void {
    this.targets.set(component, target);
  }

  unregisterTarget(component: CedarComponent, target: RevealTarget): void {
    if (this.targets.get(component) === target) {
      this.targets.delete(component);
    }
  }

  /** Whether the user has been taken to this component, in these entries of the components above it. */
  wasRevealed(path: readonly string[], occurrences: readonly number[]): boolean {
    return this.revealed.has(RevealKey.of(path, occurrences));
  }

  /**
   * Show the field or element at `location`, and resolve whether it could be shown.
   *
   * False, with nothing changed, for a path the template does not declare, for a
   * hidden component, and for an entry that does not exist. An `occurrences` shorter
   * than the repeating components along the path leaves the rest on the entry they
   * show. A repeating element with no entries stops the reveal at that element, since
   * nothing inside it is on the form.
   *
   * Run inside CEE's zone because a host calls it from its own, and the steps wait on
   * renders that only a change detection run inside CEE's zone produces.
   */
  reveal(handlerContext: HandlerContext, location: RevealLocation, options: RevealOptions = {}): Promise<boolean> {
    return this.zone.run(() => this.revealInZone(handlerContext, location, options));
  }

  private async revealInZone(
    handlerContext: HandlerContext,
    location: RevealLocation,
    options: RevealOptions,
  ): Promise<boolean> {
    const template = handlerContext.dataContext.templateRepresentation;
    const chain = componentsAlong(template, location.path);
    if (template === null || chain === null || chain.length === 0 || chain.some((component) => component.hidden)) {
      return false;
    }

    const paginator = this.paginator;
    const pageBefore = paginator?.currentPageBreakIndex ?? 0;
    if (paginator !== null && paginator.numPages() > 0) {
      const page = paginator.pageBreakChildren.findIndex((children) => children.includes(chain[0]));
      if (page < 0) {
        return false;
      }
      paginator.showPage(page);
    }

    const undo: Array<() => void> = [];
    const target = this.moveCursors(handlerContext, chain, location.occurrences ?? [], undo);
    if (target === null) {
      // Innermost first, the reverse of the order they were moved in: each inner
      // cursor belongs to the entry of its parent that was on screen when it moved.
      for (const restore of undo.reverse()) {
        restore();
      }
      paginator?.showPage(pageBefore);
      return false;
    }

    const synced = await this.renderScheduler.schedule(() => {
      const onScreen = paginator !== null && paginator.numPages() > 0 ? paginator.getCurrentPage() : template.children;
      for (const child of onScreen) {
        this.registry.updateViewToModel(child, handlerContext);
      }
      for (const component of chain.slice(0, chain.indexOf(target) + 1)) {
        this.targets.get(component)?.open();
      }
    });
    if (!synced) {
      return false;
    }
    let shown = false;
    const ran = await this.renderScheduler.schedule(() => {
      shown = this.bringIntoView(handlerContext, chain, target, options);
    });
    return ran && shown;
  }

  /**
   * Move each repeating component along the chain to the entry the location names.
   *
   * Outermost first, which is the order the cursors resolve in: an inner element's
   * entries live inside whichever entry of the outer element is on screen. Returns
   * the component to bring into view, or null when the location names an entry that
   * does not exist.
   */
  private moveCursors(
    handlerContext: HandlerContext,
    chain: readonly CedarComponent[],
    occurrences: readonly number[],
    undo: Array<() => void>,
  ): CedarComponent | null {
    let next = 0;
    for (const [position, component] of chain.entries()) {
      if (!pagesEntries(component)) {
        continue;
      }
      const info = handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(component);
      const count = info?.currentCount ?? 0;
      if (next < occurrences.length) {
        const index = occurrences[next++];
        if (info === null || !Number.isInteger(index) || index < 0 || index >= count) {
          return null;
        }
        const previous = info.currentIndex;
        undo.push(() => (info.currentIndex = previous));
        info.currentIndex = index;
      } else if (count === 0 && position < chain.length - 1) {
        return component;
      }
    }
    return next < occurrences.length ? null : chain[chain.length - 1];
  }

  private bringIntoView(
    handlerContext: HandlerContext,
    chain: readonly CedarComponent[],
    target: CedarComponent,
    options: RevealOptions,
  ): boolean {
    const host = this.targets.get(target)?.host ?? null;
    if (host === null) {
      return false;
    }
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    host.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    if (options.focus !== false) {
      RevealFocus.firstControlIn(host)?.focus({ preventScroll: true });
    }
    this.registry.markRevealed(target);
    // Keyed by the entries above the target, which is where a problem about the
    // target's own list is located.
    const above = chain.slice(0, chain.indexOf(target));
    this.revealed.add(RevealKey.of(target.path, occurrencesOnScreen(above, handlerContext.multiInstanceObjectService)));
    return true;
  }
}

class RevealKey {
  static of(path: readonly string[], occurrences: readonly number[]): string {
    return `${path.join('/')}|${occurrences.join('/')}`;
  }
}

class RevealFocus {
  /**
   * The control a user would type into or choose with, in preference to anything
   * else the field draws, such as the buttons beside its label.
   */
  private static readonly CONTROLS = [
    'input:not([type="hidden"]):not([disabled])',
    'textarea:not([disabled])',
    '[role="combobox"]',
    '[role="radio"]',
    '[role="checkbox"]',
    'select:not([disabled])',
  ];

  static firstControlIn(host: HTMLElement): HTMLElement | null {
    for (const selector of RevealFocus.CONTROLS) {
      const control = host.querySelector<HTMLElement>(selector);
      if (control !== null) {
        return control;
      }
    }
    return null;
  }
}
