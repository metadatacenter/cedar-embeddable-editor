import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { Temporal } from '../../../shared/models/temporal.model';
import { Xsd } from '../../../shared/models/xsd.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { CedarInputDatetimeComponent } from './cedar-input-datetime.component';

describe('CedarInputDatetimeComponent model-to-view sync', () => {
  it('clears every displayed temporal part when the model has no value', () => {
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
    component.component = {
      basicInfo: { temporalGranularity: Temporal.day, timezoneEnabled: false },
      valueInfo: { temporalType: Xsd.date },
    } as unknown as FieldComponent;

    component.setCurrentValue('2026-08-20');
    expect(component.dateMonthYearControl.value).not.toBeNull();

    component.setCurrentValue(null);

    expect(component.dateMonthYearControl.value).toBeNull();
    expect(component.timePickerTime).toBeNull();
    expect(component.decimalSeconds).toBeNull();
    expect(component.timezone).toBeNull();
    expect(component.hasTemporalValue()).toBe(false);
  });
});
