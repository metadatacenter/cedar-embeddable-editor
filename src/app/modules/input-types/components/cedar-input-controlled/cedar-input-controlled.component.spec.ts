import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ControlledFieldDataService } from '../../../shared/service/controlled-field-data.service';
import { MessageHandlerService } from '../../../shared/service/message-handler.service';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { InputType } from '../../../shared/models/input-type.model';
import { AuthorityTerm } from '../../../shared/models/authority/authority-search-response.model';
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

  it('cancels pending lookup, panel and hint work when the field is destroyed', () => {
    vi.useFakeTimers();
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const getData = vi.fn(() => of([]));
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
          { getData } as unknown as ControlledFieldDataService,
          { errorObject: vi.fn() } as unknown as MessageHandlerService,
        ),
    );
    component.component = {
      valueInfo: { requiredValue: false },
      basicInfo: { inputType: InputType.controlled },
      controlledInfo: {},
      path: ['term'],
    } as never;
    component.handlerContext = { changeControlledValue: vi.fn() } as never;
    component.ngOnInit();

    const closing = new Subject<unknown>();
    component.trigger = { panelClosingActions: closing } as unknown as MatAutocompleteTrigger;
    component.ngAfterViewInit();
    const setCurrentValue = vi.spyOn(component, 'setCurrentValue');
    component.selectedData = { iri: 'https://example.org/id', label: 'Selected' };
    const subscription = component.filteredOptions.subscribe();
    component.inputValueControl.setValue('pending search');
    component.inputValueControl.setValue('edited selection', { emitEvent: false });
    component.onInputBlur();
    expect(component.justReverted).toBe(true);

    injector.destroy();
    closing.next(null);
    vi.advanceTimersByTime(5000);

    expect(getData).not.toHaveBeenCalled();
    expect(setCurrentValue).not.toHaveBeenCalled();
    expect(component.justReverted, 'the destroyed component was mutated by its old hint timer').toBe(true);
    expect(subscription.closed).toBe(true);
    vi.useRealTimers();
  });

  it('unsubscribes from a controlled-term lookup already in flight', () => {
    vi.useFakeTimers();
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const response = new Subject<AuthorityTerm[]>();
    const getData = vi.fn(() => response);
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
          { getData } as unknown as ControlledFieldDataService,
          { errorObject: vi.fn() } as unknown as MessageHandlerService,
        ),
    );
    component.component = {
      valueInfo: { requiredValue: false },
      basicInfo: { inputType: InputType.controlled },
      controlledInfo: {},
      path: ['term'],
    } as never;
    component.ngOnInit();

    const subscription = component.filteredOptions.subscribe();
    component.inputValueControl.setValue('started search');
    vi.advanceTimersByTime(401);
    expect(getData).toHaveBeenCalledOnce();
    expect(response.observed).toBe(true);

    injector.destroy();

    expect(response.observed, 'the destroyed field still observed its HTTP result').toBe(false);
    expect(subscription.closed).toBe(true);
    vi.useRealTimers();
  });
});
