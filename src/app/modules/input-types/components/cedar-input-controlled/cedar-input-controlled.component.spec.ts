import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { vi } from 'vitest';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ControlledFieldDataService } from '../../../shared/service/controlled-field-data.service';
import { MessageHandlerService } from '../../../shared/service/message-handler.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { CedarInputControlledComponent } from './cedar-input-controlled.component';

describe('CedarInputControlledComponent model-to-view sync', () => {
  it('forgets the previous term when the model has no value', () => {
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: new UserPreferencesService() },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: registry },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () =>
        new CedarInputControlledComponent(
          new FormBuilder(),
          {} as ComponentDataService,
          registry,
          {} as ControlledFieldDataService,
          {} as MessageHandlerService,
        ),
    );

    component.setCurrentValue({ iri: 'https://example.org/term', label: 'Term' });
    expect(component.selectedData).toEqual({ iri: 'https://example.org/term', label: 'Term' });
    expect(component.inputValueControl.value).toBe('Term');

    component.setCurrentValue(null);

    expect(component.selectedData).toBeNull();
    expect(component.inputValueControl.value).toBeNull();
  });
});
