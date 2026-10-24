import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../../shared/service/component-data.service';
import { ExternalAuthorityLookupService } from '../../../shared/service/external-authority-lookup.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { CedarInputDoiComponent } from '../cedar-input-doi/cedar-input-doi.component';
import { CedarInputNihGrantComponent } from '../cedar-input-nih-grant/cedar-input-nih-grant.component';
import { CedarInputOrcidComponent } from '../cedar-input-orcid/cedar-input-orcid.component';
import { CedarInputPfasComponent } from '../cedar-input-pfas/cedar-input-pfas.component';
import { CedarInputPmidComponent } from '../cedar-input-pmid/cedar-input-pmid.component';
import { CedarInputRorComponent } from '../cedar-input-ror/cedar-input-ror.component';
import { CedarInputRridComponent } from '../cedar-input-rrid/cedar-input-rrid.component';

// Exercise the concrete widgets: testing only the abstract implementation cannot
// detect a copied widget that accidentally chooses another authority's descriptor.
const WIDGETS = [
  { widget: CedarInputDoiComponent, type: InputType.doi, identifier: '10.1000/example' },
  { widget: CedarInputNihGrantComponent, type: InputType.nihGrant, identifier: '1R01CA123456' },
  { widget: CedarInputOrcidComponent, type: InputType.orcid, identifier: '0000-0002-1825-0097' },
  { widget: CedarInputPfasComponent, type: InputType.pfas, identifier: 'DTXSID7020182' },
  { widget: CedarInputPmidComponent, type: InputType.pmid, identifier: '12345678' },
  { widget: CedarInputRorComponent, type: InputType.ror, identifier: '03yrm5c26' },
  { widget: CedarInputRridComponent, type: InputType.rrid, identifier: 'RRID:12345' },
];

describe('concrete authority widgets', () => {
  let injector: ReturnType<typeof Injector.create>;
  afterEach(() => {
    injector?.destroy();
    vi.useRealTimers();
  });

  for (const { widget: Widget, type, identifier } of WIDGETS) {
    it(`routes name searches and identifiers to ${type}`, () => {
      vi.useFakeTimers();
      const term = { iri: 'https://example.org/term', label: 'Example term' };
      const lookup = {
        search: vi.fn(() => of({ results: [term] })),
        resolve: vi.fn(() => of({ id: term.iri, name: term.label, found: true })),
      };
      const registry = {
        registerComponent: vi.fn(),
        unregisterComponent: vi.fn(),
      } as unknown as ActiveComponentRegistryService;
      injector = Injector.create({
        providers: [
          { provide: ActiveComponentRegistryService, useValue: registry },
          { provide: UserPreferencesService, useValue: { readOnlyMode$: of(false) } },
          { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
        ],
      });
      const component = runInInjectionContext(
        injector,
        () =>
          new Widget(
            new FormBuilder(),
            {} as ComponentDataService,
            registry,
            lookup as unknown as ExternalAuthorityLookupService,
          ),
      );
      component.componentToRender = {
        path: ['authority'],
        basicInfo: { inputType: type },
        valueInfo: { requiredValue: false },
      } as unknown as FieldComponent;
      component.ngOnInit();
      let options: unknown[] = [];
      component.filteredOptions.subscribe((value) => {
        options = value;
      });

      component.inputValueControl.setValue('Example term');
      vi.advanceTimersByTime(400);
      expect(lookup.search).toHaveBeenCalledExactlyOnceWith(type, 'Example term');
      expect(lookup.resolve).not.toHaveBeenCalled();
      expect(options).toEqual([term]);

      component.inputValueControl.setValue(identifier);
      vi.advanceTimersByTime(400);
      expect(lookup.resolve).toHaveBeenCalledExactlyOnceWith(type, identifier);
      expect(lookup.search).toHaveBeenCalledTimes(1);
      expect(options).toEqual([term]);
    });
  }
});
