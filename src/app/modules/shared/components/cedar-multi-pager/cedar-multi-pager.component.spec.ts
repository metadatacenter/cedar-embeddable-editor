import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DestroyRef } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';
import { InstanceDataContainer, TemplateInstance } from 'cedar-model-typescript-library';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { InputType } from '../../models/input-type.model';
import { CedarTemplate } from '../../models/template/cedar-template.model';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { RenderSchedulerService } from '../../service/render-scheduler.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { DataContext } from '../../util/data-context';
import { HandlerContext } from '../../util/handler-context';
import { CedarMultiPagerComponent } from './cedar-multi-pager.component';

/**
 * The control every structural edit goes through.
 *
 * Add, copy, delete and paging between occurrences are all this component
 * calling `HandlerContext`, and which of them a user is offered is decided here
 * by three predicates reading the declared bounds. It had no spec of its own, so
 * the bounds were enforced twice — once here to disable a button, once in the
 * handler to refuse the call — with nothing checking that the two agreed.
 *
 * Driven against a real handler context over a real instance rather than a
 * mocked one, because what is being asked is whether the buttons and the model
 * stay in step.
 */
describe('CedarMultiPagerComponent', () => {
  const makePager = ({ minItems = 1, maxItems = null as number | null, occurrences = 1 } = {}) => {
    const field = new MultiFieldComponent();
    field.name = 'author';
    field.path = ['author'];
    field.basicInfo.inputType = InputType.text;
    field.multiInfo.minItems = minItems;
    field.multiInfo.maxItems = maxItems;

    const template = new CedarTemplate();
    template.children = [field];

    const root = new InstanceDataContainer();
    root.setValue(
      'author',
      Array.from({ length: occurrences }, (_, i) => ({ value: `author ${i}` }) as never),
    );

    const dataContext = new DataContext();
    dataContext.templateRepresentation = template;
    dataContext.instanceFullData = { dataContainer: root } as unknown as TemplateInstance;

    const messages = new MessageHandlerService();
    const handlerContext = new HandlerContext(dataContext, messages);
    handlerContext.multiInstanceObjectService.buildNewOrFromMetadata(template, root);

    const registry = {
      registerMultiPagerComponent: vi.fn(),
      unregisterMultiPagerComponent: vi.fn(),
      updateViewToModel: vi.fn(),
      deleteCurrentValue: vi.fn(),
    } as unknown as ActiveComponentRegistryService;

    const announcer = { announce: vi.fn(() => Promise.resolve()) };
    const pager = new CedarMultiPagerComponent(
      registry,
      {
        instant: (k: string, params?: object) => (params ? `${k} ${JSON.stringify(params)}` : k),
      } as unknown as TranslateService,
      messages,
      { readOnlyMode$: of(false) } as unknown as UserPreferencesService,
      // Runs the sync straight away; the real one waits for Angular to render.
      { schedule: (task: () => void) => (task(), Promise.resolve(true)) } as unknown as RenderSchedulerService,
      { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef,
      announcer as unknown as LiveAnnouncer,
    );
    pager.handlerContext = handlerContext;
    pager.pageBreakPaginatorService = {} as PageBreakPaginatorService;
    pager.componentToRender = field;
    pager.ngOnInit();

    const count = (): number => (root.values['author'] as unknown as unknown[]).length;
    /** What the pager asked the element's live region to say, in order. */
    const said = (): unknown[][] => announcer.announce.mock.calls;
    return { pager, field, count, handlerContext, said };
  };

  describe('which actions it offers', () => {
    it('offers all three with room above and below the declared bounds', () => {
      const { pager } = makePager({ minItems: 1, maxItems: 5, occurrences: 3 });

      expect([pager.isEnabledAdd(), pager.isEnabledCopy(), pager.isEnabledDelete()]).toEqual([true, true, true]);
    });

    it('stops offering add and copy at the declared maximum', () => {
      const { pager } = makePager({ minItems: 1, maxItems: 2, occurrences: 2 });

      expect(pager.isEnabledAdd()).toBe(false);
      expect(pager.isEnabledCopy()).toBe(false);
      expect(pager.isEnabledDelete()).toBe(true);
    });

    it('stops offering delete at the declared minimum', () => {
      const { pager } = makePager({ minItems: 2, maxItems: 5, occurrences: 2 });

      expect(pager.isEnabledDelete()).toBe(false);
      expect(pager.isEnabledAdd()).toBe(true);
    });

    it('offers add but not copy or delete with nothing to page through', () => {
      const { pager } = makePager({ minItems: 0, maxItems: 5, occurrences: 0 });

      expect(pager.isEnabledAdd()).toBe(true);
      expect(pager.isEnabledCopy()).toBe(false);
      expect(pager.isEnabledDelete()).toBe(false);
    });

    it('offers add with no maximum declared', () => {
      const { pager } = makePager({ minItems: 0, maxItems: null, occurrences: 9 });

      expect(pager.isEnabledAdd()).toBe(true);
    });
  });

  /**
   * The button and the handler have to agree about a bound.
   *
   * Both enforce it — the pager by disabling the control, `HandlerContext` by
   * refusing the call — and a disagreement is invisible from either side alone.
   */
  describe('what it does to the instance', () => {
    it('adds an occurrence', () => {
      const { pager, count } = makePager({ occurrences: 2, maxItems: 5 });

      pager.clickedAdd();

      expect(count()).toBe(3);
    });

    it('copies an occurrence', () => {
      const { pager, count } = makePager({ occurrences: 2, maxItems: 5 });

      pager.clickedCopy();

      expect(count()).toBe(3);
    });

    it('deletes an occurrence', () => {
      const { pager, count } = makePager({ occurrences: 3, minItems: 1 });

      pager.clickedDelete();

      expect(count()).toBe(2);
    });

    it('adds nothing once the maximum is reached, matching its disabled button', () => {
      const { pager, count } = makePager({ occurrences: 2, maxItems: 2 });

      pager.clickedAdd();
      pager.clickedCopy();

      expect(count()).toBe(2);
    });

    it('deletes nothing at the minimum, matching its disabled button', () => {
      const { pager, count } = makePager({ occurrences: 2, minItems: 2 });

      pager.clickedDelete();

      expect(count()).toBe(2);
    });
  });

  /**
   * WCAG 4.1.3. An add, copy, delete or page turn changes the form below the pager, which no control
   * on screen reports, so the pager says what changed, politely and once.
   */
  describe('what it says', () => {
    it('names the added occurrence and the new count', () => {
      const { pager, said } = makePager({ occurrences: 2, maxItems: 5 });

      pager.clickedAdd();

      expect(said()).toEqual([['Multi.InstanceAdded {"label":"author","number":2,"count":3}', 'polite', 10_000]]);
    });

    it('names the copy and the new count', () => {
      const { pager, said } = makePager({ occurrences: 2, maxItems: 5 });

      pager.clickedCopy();

      expect(said()).toEqual([['Multi.InstanceCopied {"label":"author","number":2,"count":3}', 'polite', 10_000]]);
    });

    it('names the deleted occurrence and how many are left', () => {
      const { pager, said } = makePager({ occurrences: 3, minItems: 1 });

      pager.clickedDelete();

      expect(said()).toEqual([['Multi.InstanceDeleted {"label":"author","number":1,"count":2}', 'polite', 10_000]]);
    });

    it('names the occurrence a page turn shows', () => {
      const { pager, said } = makePager({ occurrences: 12, maxItems: null });

      pager.paginatorChanged({ pageIndex: 2, pageSize: 5, length: 12, previousPageIndex: 0 } as PageEvent);

      expect(said()).toEqual([['Multi.InstanceShown {"label":"author","number":11,"count":12}', 'polite', 10_000]]);
    });

    it('says nothing when a bound refuses the action', () => {
      const { pager, said } = makePager({ occurrences: 2, minItems: 2, maxItems: 2 });

      pager.clickedAdd();
      pager.clickedCopy();
      pager.clickedDelete();

      expect(said()).toEqual([]);
    });
  });

  describe('paging', () => {
    it('numbers every occurrence when they fit on one page', () => {
      const { pager } = makePager({ occurrences: 4, maxItems: 10 });

      expect(pager.pageNumbers).toEqual([0, 1, 2, 3]);
      expect(pager.getInstanceCount()).toBe(4);
    });

    it('numbers only the current page when they do not', () => {
      const { pager } = makePager({ occurrences: 12, maxItems: null });

      expect(pager.pageNumbers).toEqual([0, 1, 2, 3, 4]);
    });

    it('moves the cursor to the page it was sent to', () => {
      const { pager, handlerContext, field } = makePager({ occurrences: 12, maxItems: null });

      pager.paginatorChanged({ pageIndex: 2, pageSize: 5, length: 12, previousPageIndex: 0 } as PageEvent);

      expect(pager.pageNumbers).toEqual([10, 11]);
      expect(handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(field)?.currentIndex).toBe(10);
    });

    it('renumbers without moving the cursor when only the page size changes', () => {
      const { pager, handlerContext, field } = makePager({ occurrences: 12, maxItems: null });

      pager.paginatorChanged({ pageIndex: 0, pageSize: 10, length: 12, previousPageIndex: 0 } as PageEvent);

      expect(pager.pageNumbers).toHaveLength(10);
      expect(handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(field)?.currentIndex).toBe(0);
    });

    it('takes a chip click to that occurrence', () => {
      const { pager, handlerContext, field } = makePager({ occurrences: 4, maxItems: null });

      pager.chipClicked(2);

      expect(handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(field)?.currentIndex).toBe(2);
    });

    it('numbers nothing when the field holds nothing', () => {
      const { pager } = makePager({ occurrences: 0, minItems: 0 });

      expect(pager.pageNumbers).toEqual([]);
      expect(pager.hasMultiInstances()).toBe(false);
    });

    it('keeps the numbering inside the occurrences after a delete', () => {
      const { pager } = makePager({ occurrences: 3, minItems: 0 });
      pager.chipClicked(2);

      pager.clickedDelete();

      expect(pager.getInstanceCount()).toBe(2);
      expect(pager.pageNumbers).toEqual([0, 1]);
    });
  });

  it('releases its pager registration when Angular destroys it', () => {
    const { pager } = makePager();

    pager.ngOnDestroy();

    expect(pager.activeComponentRegistry.unregisterMultiPagerComponent).toHaveBeenCalledOnce();
  });
});
