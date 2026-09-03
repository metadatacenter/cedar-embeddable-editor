import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { Temporal } from '../../../shared/models/temporal.model';
import { Xsd } from '../../../shared/models/xsd.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { CedarInputDatetimeComponent } from './cedar-input-datetime.component';

describe('CedarInputDatetimeComponent model-to-view sync', () => {
  const makeComponent = (
    temporalType: string,
    granularity: string,
  ): { component: CedarInputDatetimeComponent; written: (string | null)[] } => {
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: new UserPreferencesService() },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: registry },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new CedarInputDatetimeComponent(new FormBuilder(), registry),
    );
    // Through the input setter, which is what installs the validators — the
    // widget's own message comes off them.
    component.componentToRender = {
      basicInfo: { temporalGranularity: granularity, timezoneEnabled: false, inputType: InputType.temporal },
      valueInfo: { temporalType, requiredValue: false },
      path: ['when'],
    } as unknown as FieldComponent;
    const written: (string | null)[] = [];
    component.handlerContext = {
      changeValue: (_c: unknown, value: string | null) => written.push(value),
    } as never;
    return { component, written };
  };

  it('clears every displayed temporal part when the model has no value', () => {
    const { component } = makeComponent(Xsd.date, Temporal.day);

    component.setCurrentValue('2026-08-20');
    expect(component.dateMonthYearControl.value).not.toBeNull();

    component.setCurrentValue(null);

    expect(component.dateMonthYearControl.value).toBeNull();
    expect(component.timePickerTime).toBeNull();
    expect(component.decimalSeconds).toBeNull();
    expect(component.timezone).toBeNull();
    expect(component.hasTemporalValue()).toBe(false);
  });

  it('clears every displayed temporal part when the stored value cannot be read', () => {
    // The widget is reused as a repeating field pages between occurrences. It used
    // to return without touching the pickers, so occurrence one's instant stayed on
    // screen over occurrence two — and the next edit serialized those stale parts
    // back, overwriting occurrence two with occurrence one's value.
    const { component } = makeComponent(Xsd.dateTime, Temporal.minute);
    component.setCurrentValue('2026-08-20T14:30:00');
    expect(component.dateMonthYearControl.value).not.toBeNull();

    component.setCurrentValue('2021-06-06');

    expect(component.dateMonthYearControl.value).toBeNull();
    expect(component.timePickerTime).toBeNull();
    expect(component.hasTemporalValue()).toBe(false);
  });

  it('says so when the stored value cannot be read', () => {
    const { component } = makeComponent(Xsd.dateTime, Temporal.minute);

    component.setCurrentValue('2021-06-06');

    expect(component.showsValidationMessage).toBe(true);
    expect(component.validationMessage()).toContain('xsd:dateTime');
  });

  it('states nothing about a value it could read', () => {
    const { component } = makeComponent(Xsd.dateTime, Temporal.minute);

    component.setCurrentValue('2026-08-20T14:30:00');

    expect(component.showsValidationMessage).toBe(false);
  });

  it('does not write a stale instant back when an unreadable value is edited', () => {
    const { component, written } = makeComponent(Xsd.dateTime, Temporal.minute);
    component.setCurrentValue('2026-08-20T14:30:00');
    component.setCurrentValue('2021-06-06');
    written.length = 0;

    component.timezoneInputChanged(null);

    expect(written).toEqual([null]);
  });
});
