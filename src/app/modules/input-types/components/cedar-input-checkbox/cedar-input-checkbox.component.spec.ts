import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { InstanceDataStringAtom } from 'cedar-model-typescript-library';
import { describe, expect, it, vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { ChoiceOption } from '../../../shared/models/info/choice-option.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { CedarInputCheckboxComponent } from './cedar-input-checkbox.component';

/**
 * The checkbox group, driven the way a browser drives it.
 *
 * Every check here goes through `inputChanged` with a real event rather than
 * calling `setInput` directly, because the defects these cover live in the step
 * between the option a user clicks and the control that records it — a step the
 * component's own API hides.
 */
describe('CedarInputCheckboxComponent', () => {
  interface Harness {
    component: CedarInputCheckboxComponent;
    written: (string[] | null)[];
  }

  const makeComponent = (labels: string[], defaults: string[] = [], stored: string[] | null = null): Harness => {
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
      () => new CedarInputCheckboxComponent(new FormBuilder(), registry),
    );
    component.component = {
      path: ['field'],
      choiceInfo: { multipleChoice: true, choices: labels.map((l) => new ChoiceOption(l, defaults.includes(l))) },
      valueInfo: { requiredValue: false },
    } as unknown as FieldComponent;

    const written: (string[] | null)[] = [];
    component.handlerContext = {
      getDataObjectNodeByPath: () => (stored === null ? null : stored.map((v) => new InstanceDataStringAtom(v))),
      changeListValue: (_c: FieldComponent, value: string[] | null) => written.push(value),
    } as unknown as HandlerContext;
    return { component, written };
  };

  /** What the browser sends when someone clicks an option: the label, and the new state. */
  const click = (harness: Harness, label: string, checked: boolean): void => {
    const target = { value: label, checked } as HTMLInputElement;
    harness.component.inputChanged({ target } as unknown as Event);
  };

  it('records a ticked option whose label contains a period', () => {
    // `Dr.`, `Mr.` and `Ms.` are real CEDAR option labels. A control name derived
    // from the label put a dot in it, and Angular reads a dot in `FormGroup.get`
    // as a path separator, so the lookup missed and the write threw before the
    // value could reach the instance.
    const harness = makeComponent(['Dr.', 'Prof.']);
    harness.component.ngOnInit();

    expect(() => click(harness, 'Dr.', true)).not.toThrow();

    expect(harness.written.at(-1)).toEqual(['Dr.']);
  });

  it('applies a declared default on an option whose label contains a period', () => {
    const harness = makeComponent(['Dr.', 'Prof.'], ['Dr.']);

    expect(() => harness.component.ngOnInit()).not.toThrow();

    expect(harness.written.at(-1)).toEqual(['Dr.']);
  });

  it('reads a stored value back into an option whose label contains a period', () => {
    const harness = makeComponent(['Dr.', 'Prof.'], [], ['Prof.']);

    expect(() => harness.component.ngOnInit()).not.toThrow();

    expect(harness.component.isChecked('Prof.')).toBe(true);
    expect(harness.component.isChecked('Dr.')).toBe(false);
  });

  it('gives two options that differ only in spacing a control each', () => {
    // Stripping whitespace out of the label collapsed these onto one name, and
    // `FormGroup.addControl` silently keeps the control already registered — so
    // both boxes drove one control and ticking either ticked both.
    const harness = makeComponent(['New York', 'NewYork']);
    harness.component.ngOnInit();

    click(harness, 'New York', true);

    expect(harness.component.isChecked('New York')).toBe(true);
    expect(harness.component.isChecked('NewYork')).toBe(false);
    expect(harness.written.at(-1)).toEqual(['New York']);
  });

  it('unticks the option the user unticked and no other', () => {
    const harness = makeComponent(['A', 'B']);
    harness.component.ngOnInit();
    click(harness, 'A', true);
    click(harness, 'B', true);

    click(harness, 'A', false);

    expect(harness.component.isChecked('A')).toBe(false);
    expect(harness.component.isChecked('B')).toBe(true);
    expect(harness.written.at(-1)).toEqual(['B']);
  });

  it('keeps the declared order of the options however the boxes were ticked', () => {
    const harness = makeComponent(['A', 'B', 'C']);
    harness.component.ngOnInit();

    click(harness, 'C', true);
    click(harness, 'A', true);

    expect(harness.written.at(-1)).toEqual(['A', 'C']);
  });

  it('publishes one selection per tick', () => {
    const harness = makeComponent(['A', 'B', 'C']);
    harness.component.ngOnInit();
    harness.written.length = 0;

    click(harness, 'B', true);

    expect(harness.written).toEqual([['B']]);
  });

  it('writes nothing to the model when the model pushes a value into the view', () => {
    // `setCurrentValue` is a view sync. It used to run the same path a tick runs,
    // so paging from an occurrence holding [B] to one holding [A] wrote [A, B]
    // and then corrected itself — and the host was told about both. A page turn
    // must not look like an edit.
    const harness = makeComponent(['A', 'B']);
    harness.component.ngOnInit();
    click(harness, 'B', true);
    harness.written.length = 0;

    harness.component.setCurrentValue(['A']);

    expect(harness.written).toEqual([]);
    expect(harness.component.isChecked('A')).toBe(true);
    expect(harness.component.isChecked('B')).toBe(false);
  });
});
