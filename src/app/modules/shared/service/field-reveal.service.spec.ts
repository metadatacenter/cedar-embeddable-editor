// @vitest-environment jsdom
import { NgZone } from '@angular/core';
import { vi } from 'vitest';
import { FieldRevealService, RevealTarget } from './field-reveal.service';
import { ActiveComponentRegistryService } from './active-component-registry.service';
import { PageBreakPaginatorService } from './page-break-paginator.service';
import { RenderSchedulerService } from './render-scheduler.service';
import { CedarComponent } from '../models/component/cedar-component.model';
import { CedarTemplate } from '../models/template/cedar-template.model';
import { MultiElementComponent } from '../models/element/multi-element-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import { HandlerContext } from '../util/handler-context';

/** The entries of a repeating component, and the one on screen. */
interface Entries {
  currentIndex: number;
  currentCount: number;
}

/**
 * A two-page form. The first page holds `title`. The second holds the repeating element
 * `_rows`, with three entries, and the hidden field `secret`. Each entry of `_rows` holds the
 * field `answer` and the repeating field `notes`, with two entries.
 */
const setup = ({ rows = 3, notes = 2, paged = true } = {}) => {
  const named = <T extends CedarComponent>(component: T, path: string[]): T => {
    component.name = path[path.length - 1];
    component.path = path;
    return component;
  };
  const title = named(new SingleFieldComponent(), ['title']);
  const answer = named(new SingleFieldComponent(), ['_rows', 'answer']);
  const notesField = named(new MultiFieldComponent(), ['_rows', 'notes']);
  const rowsElement = named(new MultiElementComponent(), ['_rows']);
  rowsElement.children = [answer, notesField];
  const secret = named(new SingleFieldComponent(), ['secret']);
  secret.hidden = true;
  const template = new CedarTemplate();
  template.children = [title, rowsElement, secret];

  const entries = new Map<CedarComponent, Entries>([
    [rowsElement, { currentIndex: 0, currentCount: rows }],
    [notesField, { currentIndex: 0, currentCount: notes }],
  ]);
  const handlerContext = {
    dataContext: { templateRepresentation: template },
    multiInstanceObjectService: {
      getMultiInstanceInfoForComponent: (component: CedarComponent) => entries.get(component) ?? null,
    },
  } as unknown as HandlerContext;

  const registry = { updateViewToModel: vi.fn(), markRevealed: vi.fn() };
  const renders: boolean[] = [];
  const renderScheduler = {
    // Each render completes unless a test queues one that is superseded.
    schedule: vi.fn(async (task: () => void) => {
      const completes = renders.shift() ?? true;
      if (completes) task();
      return completes;
    }),
  };
  const zone = { run: vi.fn(<T>(task: () => T): T => task()) };
  const service = new FieldRevealService(
    registry as unknown as ActiveComponentRegistryService,
    renderScheduler as unknown as RenderSchedulerService,
    zone as unknown as NgZone,
  );

  const paginator = new PageBreakPaginatorService(
    registry as unknown as ActiveComponentRegistryService,
    handlerContext,
    renderScheduler as unknown as RenderSchedulerService,
  );
  if (paged) {
    paginator.reset([[title], [rowsElement, secret]]);
  }
  service.usePaginator(paginator);

  /** A rendered component: a host holding a button beside its label, then its control. */
  const render = (component: CedarComponent) => {
    const host = document.createElement('div');
    host.innerHTML = `<button type="button">Help</button><input aria-label="${component.name}">`;
    host.scrollIntoView = vi.fn();
    document.body.append(host);
    const target = { host, open: vi.fn() };
    service.registerTarget(component, target);
    return target;
  };
  const targets = new Map<CedarComponent, ReturnType<typeof render>>(
    [title, rowsElement, answer, notesField, secret].map((component) => [component, render(component)]),
  );

  return {
    service,
    handlerContext,
    paginator,
    registry,
    renders,
    zone,
    entries,
    targets,
    components: { title, rowsElement, answer, notesField, secret, template },
  };
};

describe('FieldRevealService', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  describe('taking the user to a field', () => {
    it('turns to its page, moves the repeating element to the entry named, and opens the panels around it', async () => {
      const { service, handlerContext, paginator, entries, targets, components, registry } = setup();

      const shown = await service.reveal(handlerContext, { path: ['_rows', 'answer'], occurrences: [2] });

      expect(shown).toBe(true);
      expect(paginator.currentPageBreakIndex).toBe(1);
      expect(entries.get(components.rowsElement)!.currentIndex).toBe(2);
      expect(targets.get(components.rowsElement)!.open).toHaveBeenCalledTimes(1);
      expect(targets.get(components.title)!.open).not.toHaveBeenCalled();
      // The widgets on the page turned to are given the instance once the cursors have moved.
      expect(registry.updateViewToModel.mock.calls.map(([component]) => component)).toEqual([
        components.rowsElement,
        components.secret,
      ]);
    });

    it('scrolls the field into view, focuses its control rather than the buttons beside it, and marks it', async () => {
      const { service, handlerContext, targets, components, registry } = setup();

      await service.reveal(handlerContext, { path: ['_rows', 'answer'], occurrences: [1] });

      const host = targets.get(components.answer)!.host;
      expect(host.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
      expect(document.activeElement).toBe(host.querySelector('input'));
      expect(registry.markRevealed).toHaveBeenCalledWith(components.answer);
    });

    it('scrolls without motion where the user asks for reduced motion', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
      const { service, handlerContext, targets, components } = setup();

      await service.reveal(handlerContext, { path: ['title'] });

      expect(targets.get(components.title)!.host.scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'auto',
      });
    });

    it('leaves focus where it is when asked not to move it', async () => {
      const { service, handlerContext, targets, components } = setup();
      const elsewhere = targets.get(components.title)!.host.querySelector('input')!;
      elsewhere.focus();

      const shown = await service.reveal(
        handlerContext,
        { path: ['_rows', 'answer'], occurrences: [0] },
        { focus: false },
      );

      expect(shown).toBe(true);
      expect(targets.get(components.answer)!.host.scrollIntoView).toHaveBeenCalled();
      expect(document.activeElement).toBe(elsewhere);
    });

    it('moves each repeating level to its entry, outermost first', async () => {
      const { service, handlerContext, entries, components } = setup();

      expect(await service.reveal(handlerContext, { path: ['_rows', 'notes'], occurrences: [2, 1] })).toBe(true);

      expect(entries.get(components.rowsElement)!.currentIndex).toBe(2);
      expect(entries.get(components.notesField)!.currentIndex).toBe(1);
    });

    it('leaves the repeating levels the location does not name on the entry they show', async () => {
      const { service, handlerContext, entries, components } = setup();
      entries.get(components.rowsElement)!.currentIndex = 1;
      entries.get(components.notesField)!.currentIndex = 1;

      expect(await service.reveal(handlerContext, { path: ['_rows', 'notes'], occurrences: [2] })).toBe(true);

      expect(entries.get(components.rowsElement)!.currentIndex).toBe(2);
      expect(entries.get(components.notesField)!.currentIndex).toBe(1);
    });

    it('stops at a repeating element with no entries, since nothing inside it is on the form', async () => {
      const { service, handlerContext, targets, components, registry } = setup({ rows: 0 });

      expect(await service.reveal(handlerContext, { path: ['_rows', 'answer'] })).toBe(true);

      expect(targets.get(components.rowsElement)!.host.scrollIntoView).toHaveBeenCalled();
      expect(targets.get(components.answer)!.host.scrollIntoView).not.toHaveBeenCalled();
      expect(registry.markRevealed).toHaveBeenCalledWith(components.rowsElement);
      expect(service.wasRevealed(['_rows'], [])).toBe(true);
    });

    it('gives the instance to the whole form when it has no pages', async () => {
      const { service, handlerContext, registry, components } = setup({ paged: false });

      expect(await service.reveal(handlerContext, { path: ['title'] })).toBe(true);

      expect(registry.updateViewToModel.mock.calls.map(([component]) => component)).toEqual(
        components.template.children,
      );
    });

    it('runs inside the editor zone, because a host calls it from its own', async () => {
      const { service, handlerContext, zone } = setup();

      await service.reveal(handlerContext, { path: ['title'] });

      expect(zone.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('remembering where the user was taken', () => {
    it('records the field in the entries of the components above it', async () => {
      const { service, handlerContext } = setup();
      expect(service.wasRevealed(['_rows', 'notes'], [1])).toBe(false);

      await service.reveal(handlerContext, { path: ['_rows', 'notes'], occurrences: [1, 0] });

      // A problem with the list itself is located by the entries above it, not by its own.
      expect(service.wasRevealed(['_rows', 'notes'], [1])).toBe(true);
      expect(service.wasRevealed(['_rows', 'notes'], [1, 0])).toBe(false);
      expect(service.wasRevealed(['_rows', 'notes'], [0])).toBe(false);
      expect(service.wasRevealed(['_rows', 'answer'], [1])).toBe(false);
    });

    it('records nothing for a reveal that fails', async () => {
      const { service, handlerContext } = setup();

      await service.reveal(handlerContext, { path: ['_rows', 'answer'], occurrences: [7] });

      expect(service.wasRevealed(['_rows', 'answer'], [7])).toBe(false);
      expect(service.wasRevealed(['_rows', 'answer'], [0])).toBe(false);
    });
  });

  describe('refusing a place that cannot be shown', () => {
    const unchanged = async (
      location: { path: string[]; occurrences?: number[] },
      options: Parameters<typeof setup>[0] = {},
    ) => {
      const fixture = setup(options);
      const { service, handlerContext, paginator, entries, targets, components, registry } = fixture;
      entries.get(components.rowsElement)!.currentIndex = 1;
      entries.get(components.notesField)!.currentIndex = 1;

      const shown = await service.reveal(handlerContext, location);

      expect(shown).toBe(false);
      expect(paginator.currentPageBreakIndex).toBe(0);
      expect(entries.get(components.rowsElement)!.currentIndex).toBe(1);
      expect(entries.get(components.notesField)!.currentIndex).toBe(1);
      for (const target of targets.values()) {
        expect(target.open).not.toHaveBeenCalled();
        expect(target.host.scrollIntoView).not.toHaveBeenCalled();
      }
      expect(registry.updateViewToModel).not.toHaveBeenCalled();
      expect(registry.markRevealed).not.toHaveBeenCalled();
    };

    it('refuses a path the template does not declare', () => unchanged({ path: ['_rows', 'missing'] }));

    it('refuses an empty path', () => unchanged({ path: [] }));

    it('refuses a hidden field', () => unchanged({ path: ['secret'] }));

    it('refuses an entry that does not exist', () => unchanged({ path: ['_rows', 'answer'], occurrences: [3] }));

    it('refuses an entry that is not a whole number', () =>
      unchanged({ path: ['_rows', 'answer'], occurrences: [0.5] }));

    it('refuses a negative entry', () => unchanged({ path: ['_rows', 'answer'], occurrences: [-1] }));

    it('puts back the outer entry it moved when an inner one does not exist', () =>
      unchanged({ path: ['_rows', 'notes'], occurrences: [2, 5] }));

    it('refuses more entries than the path has repeating levels', () =>
      unchanged({ path: ['_rows', 'answer'], occurrences: [2, 0] }));

    it('refuses a field on no page of the form', async () => {
      const { service, handlerContext, paginator, components } = setup();
      paginator.reset([[components.title]]);

      expect(await service.reveal(handlerContext, { path: ['_rows', 'answer'], occurrences: [0] })).toBe(false);
    });

    it('resolves false when a newer render supersedes the one it waits for', async () => {
      const { service, handlerContext, renders, targets, components } = setup();
      renders.push(false);

      expect(await service.reveal(handlerContext, { path: ['title'] })).toBe(false);
      expect(targets.get(components.title)!.host.scrollIntoView).not.toHaveBeenCalled();
      expect(service.wasRevealed(['title'], [])).toBe(false);
    });

    it('resolves false when the second render is superseded', async () => {
      const { service, handlerContext, renders, targets, components } = setup();
      renders.push(true, false);

      expect(await service.reveal(handlerContext, { path: ['title'] })).toBe(false);
      expect(targets.get(components.title)!.host.scrollIntoView).not.toHaveBeenCalled();
    });

    it('resolves false for a field that is not rendered', async () => {
      const { service, handlerContext, targets, components } = setup();
      service.unregisterTarget(components.title, targets.get(components.title)!);

      expect(await service.reveal(handlerContext, { path: ['title'] })).toBe(false);
      expect(service.wasRevealed(['title'], [])).toBe(false);
    });
  });

  it('keeps a target that a component registered after the one being removed', async () => {
    const { service, handlerContext, targets, components } = setup();
    const replaced: RevealTarget = targets.get(components.title)!;
    const current = { host: replaced.host, open: vi.fn() };
    service.registerTarget(components.title, current);

    service.unregisterTarget(components.title, replaced);

    expect(await service.reveal(handlerContext, { path: ['title'] })).toBe(true);
  });
});
