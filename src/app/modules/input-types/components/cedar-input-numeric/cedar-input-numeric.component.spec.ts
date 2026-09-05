import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { Xsd } from '../../../shared/models/xsd.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { CedarInputNumericComponent } from './cedar-input-numeric.component';

/**
 * The numeric widget's own decisions.
 *
 * What a number must look like is `FieldValueValidator`'s, and the harness
 * covers it. What is decided here is which text that validator is shown: the
 * box is a `type="number"` input, and Angular's accessor for one hands the
 * control `parseFloat` of what was typed, so `1.50` in a one-decimal field
 * reached the validator as `1.5` and passed while the model held `1.50` and the
 * quality report failed it. The two are meant to be one verdict.
 * `numeric-typed-text.coordinator.spec.ts` drives the rendered input; this asks
 * the widget alone.
 */
describe('CedarInputNumericComponent', () => {
  const makeComponent = (
    numberInfo: Partial<FieldComponent['numberInfo']>,
  ): { component: CedarInputNumericComponent; written: (string | null)[] } => {
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
      () =>
        new CedarInputNumericComponent(new FormBuilder(), {} as ComponentDataService, registry, {
          instant: () => '',
        } as unknown as TranslateService),
    );
    component.componentToRender = {
      path: ['amount'],
      name: 'amount',
      basicInfo: { inputType: InputType.numeric },
      valueInfo: { requiredValue: false, minLength: null, maxLength: null, regex: null },
      numberInfo: {
        numberType: null,
        decimalPlace: null,
        minValue: null,
        maxValue: null,
        unitOfMeasure: null,
        ...numberInfo,
      },
      choiceInfo: { multipleChoice: false, choices: [] },
    } as unknown as FieldComponent;
    const written: (string | null)[] = [];
    component.handlerContext = {
      changeValue: (_c: unknown, value: string | null) => written.push(value),
    } as unknown as HandlerContext;
    component.ngOnInit();
    return { component, written };
  };

  const typed = (text: string): Event => ({ target: { value: text } }) as unknown as Event;

  it('judges the text the user typed, not the number the browser parsed', () => {
    const { component } = makeComponent({ numberType: Xsd.decimal, decimalPlace: 1 });

    component.inputChanged(typed('1.50'));

    expect(component.inputValueControl.value).toBe('1.50');
    expect(component.inputValueControl.hasError('pattern')).toBe(true);
  });

  it('records the text as typed', () => {
    const { component, written } = makeComponent({ numberType: Xsd.decimal, decimalPlace: 1 });

    component.inputChanged(typed('1.50'));

    expect(written).toEqual(['1.50']);
  });

  it('accepts a value within the places the field declares', () => {
    const { component } = makeComponent({ numberType: Xsd.decimal, decimalPlace: 1 });

    component.inputChanged(typed('1.5'));

    expect(component.inputValueControl.valid).toBe(true);
  });

  /**
   * The step the spinner moves by, from the declared type and places. The
   * browser's default is one, which stepped a two-place field past every value
   * it is for.
   */
  it.each([
    ['an integer', { numberType: Xsd.int }, '1'],
    ['a long', { numberType: Xsd.long }, '1'],
    ['a decimal with two places', { numberType: Xsd.decimal, decimalPlace: 2 }, '0.01'],
    ['a float with one place', { numberType: Xsd.float, decimalPlace: 1 }, '0.1'],
    ['a decimal with no places', { numberType: Xsd.decimal, decimalPlace: 0 }, '1'],
    ['a double declaring no places', { numberType: Xsd.double }, 'any'],
    ['a field declaring no type', {}, 'any'],
  ] as const)('steps %s by %s', (_name, numberInfo, step) => {
    const { component } = makeComponent(numberInfo);

    expect(component.step).toBe(step);
  });

  it('rejects exponent notation for an integer, as the report does', () => {
    const { component } = makeComponent({ numberType: Xsd.int });

    component.inputChanged(typed('1e3'));

    expect(component.inputValueControl.hasError('pattern')).toBe(true);
  });
});
