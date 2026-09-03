import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ChoiceOption } from '../../../shared/models/info/choice-option.model';
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

  const makeComponent = (labels: string[], { multiple = false, maxItems = null as number | null } = {}): Harness => {
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
      valueInfo: { requiredValue: false },
      multiInfo: { maxItems },
      basicInfo: {},
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

    expect(component.readOnlyValue).toBe('A, B');
  });

  it('reads a single selection back as itself', () => {
    const { component } = makeComponent(['A', 'B']);

    component.setCurrentValue('B');

    expect(component.readOnlyValue).toBe('B');
  });

  it('reads an unanswered field back as nothing', () => {
    const { component } = makeComponent(['A', 'B'], { multiple: true });

    component.setCurrentValue(null);

    expect(component.readOnlyValue).toBe('');
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
});
