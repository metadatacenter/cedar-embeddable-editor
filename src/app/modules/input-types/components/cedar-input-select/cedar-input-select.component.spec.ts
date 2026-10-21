// @vitest-environment jsdom
import { ChangeDetectorRef, ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatSelect } from '@angular/material/select';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ChoiceOption } from '../../../shared/models/info/choice-option.model';
import { LabelInfo } from '../../../shared/models/info/label-info.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { CedarInputSelectComponent } from './cedar-input-select.component';

describe('CedarInputSelectComponent', () => {
  interface Harness {
    component: CedarInputSelectComponent;
    written: unknown[];
  }

  const makeComponent = (
    labels: string[],
    { multiple = false, maxItems = null as number | null, required = false, language = null as string | null } = {},
  ): Harness => {
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const injector = Injector.create({
      providers: [
        { provide: ActiveComponentRegistryService, useValue: registry },
        { provide: UserPreferencesService, useValue: { readOnlyMode$: of(false) } },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new CedarInputSelectComponent(registry, {} as ComponentDataService, new FormBuilder()),
    );
    component.componentToRender = {
      path: ['pick'],
      choiceInfo: { multipleChoice: multiple, choices: labels.map((l) => new ChoiceOption(l, false)) },
      valueInfo: { requiredValue: required },
      multiInfo: { maxItems },
      basicInfo: {},
      labelInfo: Object.assign(new LabelInfo(), { language }),
    } as unknown as FieldComponent;
    const written: unknown[] = [];
    component.handlerContext = {
      changeValue: (_c: unknown, value: unknown) => written.push(value),
      changeListValue: (_c: unknown, value: unknown) => written.push(value),
    } as unknown as HandlerContext;
    component.ngOnInit();
    return { component, written };
  };

  it('reads a multiple selection back as a list rather than as a coerced array', () => {
    // Read-only, the chosen labels went into a text input through the form
    // control, and the DOM turned the array into `A,B` — no space, and nothing
    // saying it is more than one value.
    const { component } = makeComponent(['A', 'B', 'C'], { multiple: true });

    component.setCurrentValue(['A', 'B']);

    expect(component.displayValue).toBe('A · B');
  });

  it('reads a single selection back as itself', () => {
    const { component } = makeComponent(['A', 'B']);

    component.setCurrentValue('B');

    expect(component.displayValue).toBe('B');
  });

  it('reads an unanswered field back as nothing', () => {
    const { component } = makeComponent(['A', 'B'], { multiple: true });

    component.setCurrentValue(null);

    expect(component.displayValue).toBe('');
  });

  it('preserves punctuation in labels and stores the original selected values', () => {
    const labels = ['A, B', 'C · D'];
    const { component, written } = makeComponent(labels, { multiple: true });
    component.setCurrentValue(labels);
    component.inputChanged();
    expect(component.displayValue).toBe('A, B · C · D');
    expect(written.at(-1)).toEqual(labels);
  });

  it('forgets a cleared selection rather than restoring it at the bound', () => {
    // `clearValue` left `selections` holding what had been cleared, and that is
    // what the max-selection guard puts back when a further pick goes over the
    // bound — so a rejected pick resurrected a selection the user had cleared.
    const { component, written } = makeComponent(['A', 'B', 'C'], { multiple: true, maxItems: 1 });
    component.inputValueControl.setValue(['A']);
    component.inputChanged();
    component.clearValue(new Event('click'));
    written.length = 0;

    component.inputValueControl.setValue(['B', 'C']);
    component.inputChanged();

    expect(component.inputValueControl.value).toEqual([]);
    expect(written.at(-1)).toEqual([]);
  });

  it('keeps a selection within the bound', () => {
    const { component, written } = makeComponent(['A', 'B', 'C'], { multiple: true, maxItems: 2 });

    component.inputValueControl.setValue(['A', 'B']);
    component.inputChanged();

    expect(written.at(-1)).toEqual(['A', 'B']);
  });

  it('rejects the first over-bound edit without erasing a loaded selection', () => {
    // Model-to-view sync did not seed `selections`, the rollback cache. If the
    // loaded instance was already at maxItems, its first rejected pick restored
    // the cache's initial [] and wrote that empty list back into the instance.
    const { component, written } = makeComponent(['A', 'B', 'C'], { multiple: true, maxItems: 2 });
    component.setCurrentValue(['A', 'B']);

    component.inputValueControl.setValue(['A', 'B', 'C']);
    component.inputChanged();

    expect(component.inputValueControl.value).toEqual(['A', 'B']);
    expect(written.at(-1)).toEqual(['A', 'B']);
  });

  it.each([[[null]], [['']], [[null, '', 'A']]] as const)(
    'treats empty model slots %j as no multi-selection',
    (loaded) => {
      // A cleared list is represented in the instance by one null literal.
      // Angular's required validator considers [null] and [''] non-empty, so
      // the widget has to project model slots to selected option labels first.
      const { component } = makeComponent(['A', 'B'], { multiple: true, required: true });
      const expected = (loaded as readonly unknown[]).filter(
        (entry): entry is string => typeof entry === 'string' && entry.length > 0,
      );

      component.setCurrentValue([...loaded]);

      expect(component.inputValueControl.value).toEqual(expected);
      expect(component.inputValueControl.hasError('required')).toBe(expected.length === 0);
    },
  );

  describe('the open panel', () => {
    /** Open a panel the way Material draws it: in the same root as the select, under the select's id. */
    const openPanel = (component: CedarInputSelectComponent): HTMLElement => {
      const root = document.createElement('div').attachShadow({ mode: 'open' });
      const select = document.createElement('mat-select');
      const panel = document.createElement('div');
      panel.id = 'mat-select-3-panel';
      root.append(select, panel);
      component.selectElement = { id: 'mat-select-3', _elementRef: new ElementRef(select) } as unknown as MatSelect;
      component.panelOpened(true);
      return panel;
    };

    it("is marked with the language of the template's text, which its name is in", () => {
      const { component } = makeComponent(['A', 'B'], { language: 'fr' });

      expect(openPanel(component).getAttribute('lang')).toBe('fr');
    });

    it("states no language where the template declares none, and so takes CEE's from the overlay", () => {
      const { component } = makeComponent(['A', 'B']);

      expect(openPanel(component).hasAttribute('lang')).toBe(false);
    });
  });
});
