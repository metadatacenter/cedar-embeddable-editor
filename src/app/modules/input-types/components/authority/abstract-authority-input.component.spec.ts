import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ExternalAuthorityLookupService } from '../../../shared/service/external-authority-lookup.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { AuthorityDescriptor } from '../../../shared/models/authority/authority-descriptor.model';
import { AuthoritySearchResponse } from '../../../shared/models/authority/authority-search-response.model';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { HandlerContext } from '../../../shared/util/handler-context';
import { AbstractAuthorityInputComponent } from './abstract-authority-input.component';

class TestAuthorityComponent extends AbstractAuthorityInputComponent {
  readonly descriptor: AuthorityDescriptor = {
    inputType: InputType.pfas,
    label: 'test authority',
    placeholderKey: 'placeholder',
    invalidMessageKey: 'invalid',
    revertedMessageKey: 'reverted',
    searchPath: 'search',
    detailsPath: 'details',
    looksLikeIdentifier: () => false,
  };

  constructor(
    fb: FormBuilder,
    cds: ComponentDataService,
    registry: ActiveComponentRegistryService,
    lookup: ExternalAuthorityLookupService,
  ) {
    super(fb, cds, registry, lookup);
  }

  beginRevertHint(): void {
    this.showRevertHint();
  }
}

describe('AbstractAuthorityInputComponent teardown', () => {
  it('cancels pending searches, panel work and hints when the field is destroyed', () => {
    vi.useFakeTimers();
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const lookup = {
      search: vi.fn(() => of({ results: [] })),
      resolve: vi.fn(() => of(null)),
    } as unknown as ExternalAuthorityLookupService;
    const injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: new UserPreferencesService() },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: registry },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new TestAuthorityComponent(new FormBuilder(), {} as ComponentDataService, registry, lookup),
    );
    component.component = {
      valueInfo: { requiredValue: false },
      basicInfo: {},
      path: ['authority'],
    } as unknown as FieldComponent;
    component.handlerContext = {
      changeControlledValue: vi.fn(),
    } as unknown as HandlerContext;
    component.ngOnInit();

    const closing = new Subject<unknown>();
    const openPanel = vi.fn();
    component.trigger = {
      panelClosingActions: closing,
      panelOpen: false,
      openPanel,
    } as unknown as MatAutocompleteTrigger;
    component.ngAfterViewInit();
    const setCurrentValue = vi.spyOn(component, 'setCurrentValue');
    component.selectedData = { iri: 'https://example.org/id', label: 'Selected' };

    const subscription = component.filteredOptions.subscribe();
    component.inputValueControl.setValue('pending search');
    component.inputChanged({ target: { value: 'pending search' } } as unknown as Event);
    component.beginRevertHint();

    injector.destroy();
    closing.next(null);
    vi.advanceTimersByTime(5000);

    expect(lookup.search).not.toHaveBeenCalled();
    expect(openPanel).not.toHaveBeenCalled();
    expect(setCurrentValue).not.toHaveBeenCalled();
    expect(component.justReverted, 'the destroyed component was mutated by its old hint timer').toBe(true);
    expect(subscription.closed).toBe(true);
    vi.useRealTimers();
  });

  it('unsubscribes from an authority lookup already in flight', () => {
    vi.useFakeTimers();
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const response = new Subject<AuthoritySearchResponse>();
    const lookup = {
      search: vi.fn(() => response),
      resolve: vi.fn(() => of(null)),
    } as unknown as ExternalAuthorityLookupService;
    const injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: new UserPreferencesService() },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: registry },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new TestAuthorityComponent(new FormBuilder(), {} as ComponentDataService, registry, lookup),
    );
    component.component = {
      valueInfo: { requiredValue: false },
      basicInfo: {},
      path: ['authority'],
    } as unknown as FieldComponent;
    component.ngOnInit();

    const subscription = component.filteredOptions.subscribe();
    component.inputValueControl.setValue('started search');
    vi.advanceTimersByTime(401);
    expect(lookup.search).toHaveBeenCalledOnce();
    expect(response.observed).toBe(true);

    injector.destroy();

    expect(response.observed, 'the destroyed field still observed its HTTP result').toBe(false);
    expect(subscription.closed).toBe(true);
    vi.useRealTimers();
  });
});
