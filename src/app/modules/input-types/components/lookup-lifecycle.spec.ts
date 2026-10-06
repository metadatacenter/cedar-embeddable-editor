import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { vi } from 'vitest';
import { CedarInputControlledComponent } from './cedar-input-controlled/cedar-input-controlled.component';
import { CedarInputOrcidComponent } from './cedar-input-orcid/cedar-input-orcid.component';
import { ActiveComponentRegistryService } from '../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../shared/service/component-data.service';
import { ControlledFieldDataService } from '../../shared/service/controlled-field-data.service';
import { ExternalAuthorityLookupService } from '../../shared/service/external-authority-lookup.service';
import { MessageHandlerService } from '../../shared/service/message-handler.service';
import { UserPreferencesService } from '../../shared/service/user-preferences.service';
import { AuthorityTerm } from '../../shared/models/authority/authority-search-response.model';
import { FieldComponent } from '../../shared/models/component/field-component.model';
import { InputType } from '../../shared/models/input-type.model';

class LookupAuthority extends CedarInputOrcidComponent {
  override filter(query: string): Observable<AuthorityTerm[]> {
    return super.filter(query);
  }
}

const mountLookup = (kind: 'controlled' | 'authority') => {
  const preferences = new UserPreferencesService();
  const registry = { unregisterComponent: vi.fn() } as unknown as ActiveComponentRegistryService;
  const injector = Injector.create({
    providers: [
      { provide: UserPreferencesService, useValue: preferences },
      { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
      { provide: ActiveComponentRegistryService, useValue: registry },
    ],
  });
  const component = runInInjectionContext(injector, () =>
    kind === 'controlled'
      ? new CedarInputControlledComponent(
          new FormBuilder(),
          {} as ComponentDataService,
          registry,
          {} as ControlledFieldDataService,
          { errorObject: vi.fn() } as unknown as MessageHandlerService,
        )
      : new LookupAuthority(
          new FormBuilder(),
          {} as ComponentDataService,
          registry,
          {} as ExternalAuthorityLookupService,
        ),
  );
  component.component = {
    valueInfo: { requiredValue: false },
    basicInfo: { inputType: InputType.controlled },
    controlledInfo: {},
    path: ['term'],
  } as unknown as FieldComponent;
  const requests: Subject<AuthorityTerm[]>[] = [];
  vi.spyOn(component, 'filter').mockImplementation(() => {
    const response = new Subject<AuthorityTerm[]>();
    requests.push(response);
    return response;
  });
  component.ngOnInit();
  const delivered: AuthorityTerm[][] = [];
  const subscription = component.filteredOptions.subscribe((terms) => delivered.push(terms));
  return { component, injector, preferences, requests, delivered, subscription };
};

const loading = (component: CedarInputControlledComponent | CedarInputOrcidComponent) =>
  component instanceof CedarInputControlledComponent ? component.loading : component.loadingOptions;

const cases = (['controlled', 'authority'] as const).flatMap((kind) =>
  (['query', 'readOnly', 'destroy'] as const).map((transition) => ({ kind, transition })),
);

it.each(cases)('$kind lookup cancels immediately on $transition', ({ kind, transition }) => {
  vi.useFakeTimers();
  const mounted = mountLookup(kind);
  const { component, preferences, injector, requests, delivered } = mounted;
  try {
    component.inputValueControl.setValue('old');
    vi.advanceTimersByTime(400);
    const old = requests[0];
    expect(old.observed).toBe(true);
    delivered.length = 0;
    if (transition === 'query') component.inputValueControl.setValue('new');
    if (transition === 'readOnly') preferences.setReadOnlyMode(true);
    if (transition === 'destroy') injector.destroy();
    expect(old.observed).toBe(false);
    old.next([{ iri: 'urn:old', label: 'Old' }]);
    expect(delivered.flat()).toEqual([]);
    expect(loading(component)).toBe(transition === 'query');
    if (transition === 'readOnly') preferences.setReadOnlyMode(false);
    if (transition !== 'destroy') {
      vi.advanceTimersByTime(400);
      const latest = requests.at(-1)!;
      latest.next([{ iri: 'urn:latest', label: 'Latest' }]);
      latest.complete();
      expect(delivered.at(-1)).toEqual([{ iri: 'urn:latest', label: 'Latest' }]);
      expect(loading(component)).toBe(false);
    }
  } finally {
    if (transition !== 'destroy') injector.destroy();
    vi.useRealTimers();
  }
});

it.each(['controlled', 'authority'] as const)('%s lookup state belongs to each live wrapper scope', (kind) => {
  vi.useFakeTimers();
  const first = mountLookup(kind);
  const second = mountLookup(kind);
  try {
    first.component.inputValueControl.setValue('first');
    second.component.inputValueControl.setValue('second');
    vi.advanceTimersByTime(400);
    const firstRequest = first.requests[0];
    const secondRequest = second.requests[0];
    first.preferences.setReadOnlyMode(true);
    expect(firstRequest.observed).toBe(false);
    expect(secondRequest.observed).toBe(true);
    expect(loading(first.component)).toBe(false);
    expect(loading(second.component)).toBe(true);
    firstRequest.error(new Error('Discarded failure'));
    secondRequest.next([{ iri: 'urn:second', label: 'Second' }]);
    secondRequest.complete();
    expect(first.component.lookupFailed).toBe(false);
    expect(first.delivered.flat()).toEqual([]);
    expect(second.delivered.at(-1)).toEqual([{ iri: 'urn:second', label: 'Second' }]);
    expect(loading(second.component)).toBe(false);
  } finally {
    first.injector.destroy();
    second.injector.destroy();
    vi.useRealTimers();
  }
});
