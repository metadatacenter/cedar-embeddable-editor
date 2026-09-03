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

/**
 * What a blur does to text that names no term.
 *
 * These fields are search boxes over an authority: the control holds what is
 * being typed, and a value exists only once a suggestion is picked. So text left
 * behind on blur cannot be saved, and leaving it in the box is worse than an
 * empty field — it looks filled and reads back blank. Six of the seven widgets
 * did exactly that until the rule moved into `AuthoritySearchControl`.
 *
 * The rule itself has a harness spec. What had none is this class, which decides
 * *when* to apply it — and the guard that stops a blur caused by reaching for a
 * suggestion from clearing the very term being chosen.
 */
class ConfigurableAuthorityComponent extends AbstractAuthorityInputComponent {
  identifierPattern: (query: string) => boolean = () => false;

  get descriptor(): AuthorityDescriptor {
    return {
      inputType: InputType.pfas,
      label: 'test authority',
      placeholderKey: 'placeholder',
      invalidMessageKey: 'invalid',
      revertedMessageKey: 'reverted',
      searchPath: 'search',
      detailsPath: 'details',
      looksLikeIdentifier: (query: string) => this.identifierPattern(query),
    };
  }

  constructor(
    fb: FormBuilder,
    cds: ComponentDataService,
    registry: ActiveComponentRegistryService,
    lookup: ExternalAuthorityLookupService,
  ) {
    super(fb, cds, registry, lookup);
  }
}

describe('AbstractAuthorityInputComponent', () => {
  interface Harness {
    component: ConfigurableAuthorityComponent;
    written: { iri: string | null; label: string | null }[];
    lookup: ExternalAuthorityLookupService;
  }

  const makeComponent = ({
    readOnly = false,
    results = [] as { iri: string; label: string }[],
    resolved = null as { id: string; name: string; found?: boolean } | null,
  } = {}): Harness => {
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const lookup = {
      search: vi.fn(() => of({ results })),
      resolve: vi.fn(() => of(resolved)),
    } as unknown as ExternalAuthorityLookupService;
    const preferences = new UserPreferencesService();
    preferences.setReadOnlyMode(readOnly);
    const injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: preferences },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: registry },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new ConfigurableAuthorityComponent(new FormBuilder(), {} as ComponentDataService, registry, lookup),
    );
    component.component = {
      valueInfo: { requiredValue: false },
      basicInfo: { inputType: InputType.pfas },
      path: ['authority'],
    } as unknown as FieldComponent;
    const written: { iri: string | null; label: string | null }[] = [];
    component.handlerContext = {
      changeControlledValue: (_c: unknown, iri: string | null, label: string | null) => written.push({ iri, label }),
    } as unknown as HandlerContext;
    component.ngOnInit();
    return { component, written, lookup };
  };

  const TERM = { iri: 'https://example.org/DTXSID7020182', label: 'Bisphenol A' };

  describe('leaving the field', () => {
    it('discards text that names no term, and tells the model', () => {
      const { component, written } = makeComponent();
      component.inputValueControl.setValue('half a name');

      component.onInputBlur();

      expect(component.inputValueControl.value).toBe('');
      expect(written).toEqual([{ iri: null, label: null }]);
      expect(component.justCleared).toBe(true);
    });

    it('restores the selected term when the text was edited away from it', () => {
      const { component, written } = makeComponent();
      component.onSelectionChange(TERM);
      written.length = 0;
      component.inputValueControl.setValue('Bisphen');

      component.onInputBlur();

      expect(component.inputValueControl.value).toBe(component.getCompoundValue(TERM));
      expect(component.justReverted).toBe(true);
      expect(written, 'a discarded edit is not a change to the value').toEqual([]);
    });

    it('does nothing to an empty field nobody has typed in', () => {
      const { component, written } = makeComponent();

      component.onInputBlur();

      expect(written).toEqual([]);
      expect([component.justCleared, component.justReverted]).toEqual([false, false]);
    });

    it('does nothing to a field showing exactly its term', () => {
      const { component, written } = makeComponent();
      component.onSelectionChange(TERM);
      component.setCurrentValue(TERM);
      written.length = 0;

      component.onInputBlur();

      expect(written).toEqual([]);
      expect(component.justReverted).toBe(false);
    });

    it('keeps the term being clicked rather than clearing it', () => {
      // Clicking a suggestion blurs the input, and the blur arrives before
      // Material reports the selection. Reconciling there read `selectedData` as
      // still null and cleared the very value being chosen.
      const { component, written } = makeComponent();
      component.inputValueControl.setValue('Bisph');

      component.selectionStarting();
      component.onInputBlur();

      expect(written).toEqual([]);
      expect(component.inputValueControl.value).toBe('Bisph');
    });

    it('leaves a read-only field alone', () => {
      const { component, written } = makeComponent({ readOnly: true });
      component.inputValueControl.setValue('text nobody can edit');

      component.onInputBlur();

      expect(component.inputValueControl.value).toBe('text nobody can edit');
      expect(written).toEqual([]);
    });
  });

  describe('choosing a suggestion', () => {
    it('records the term behind it', () => {
      const { component, written } = makeComponent();

      component.onSelectionChange(TERM);

      expect(written).toEqual([{ iri: TERM.iri, label: TERM.label }]);
      expect(component.selectedData).toEqual(TERM);
    });

    it('records nothing for a suggestion carrying neither half', () => {
      const { component, written } = makeComponent();

      component.onSelectionChange({ iri: '', label: '' });

      expect(written).toEqual([{ iri: null, label: null }]);
    });

    it('shows the term as "label - iri"', () => {
      const { component } = makeComponent();

      expect(component.getCompoundValue(TERM)).toBe(`${TERM.label} - ${TERM.iri}`);
      expect(component.getCompoundValue(null)).toBe('');
    });

    it('clears both the box and the value', () => {
      const { component, written } = makeComponent();
      component.onSelectionChange(TERM);
      written.length = 0;

      component.clearValue();

      expect(component.selectedData).toBeNull();
      expect(component.inputValueControl.value).toBeNull();
      expect(written).toEqual([{ iri: null, label: null }]);
    });
  });

  describe('closing the panel', () => {
    const withTrigger = (harness: Harness): Subject<unknown> => {
      const closing = new Subject<unknown>();
      harness.component.trigger = {
        panelClosingActions: closing,
        panelOpen: false,
        openPanel: vi.fn(),
      } as unknown as MatAutocompleteTrigger;
      harness.component.ngAfterViewInit();
      return closing;
    };

    it('puts the selected term back when it closes without one being chosen', () => {
      const harness = makeComponent();
      const closing = withTrigger(harness);
      harness.component.onSelectionChange(TERM);
      harness.component.inputValueControl.setValue('typed over it');

      closing.next(null);

      expect(harness.component.inputValueControl.value).toBe(harness.component.getCompoundValue(TERM));
    });

    it('leaves the box alone when a suggestion is what closed it', () => {
      const harness = makeComponent();
      const closing = withTrigger(harness);
      harness.component.onSelectionChange(TERM);
      harness.component.inputValueControl.setValue('mid-selection');

      closing.next({ source: {} });

      expect(harness.component.inputValueControl.value).toBe('mid-selection');
    });

    it('releases the in-progress flag so a later blur still reconciles', () => {
      // A press that closed the panel without choosing — dragged off the option,
      // or a click outside — left the flag set, and every later blur declined to
      // reconcile for the rest of the session.
      const harness = makeComponent();
      const closing = withTrigger(harness);
      harness.component.selectionStarting();

      closing.next(null);
      harness.component.inputValueControl.setValue('names no term');
      harness.component.onInputBlur();

      expect(harness.component.inputValueControl.value).toBe('');
    });
  });

  describe('what it searches for', () => {
    it('resolves text that looks like an identifier', () => {
      const harness = makeComponent({ resolved: { id: TERM.iri, name: TERM.label } });
      harness.component.identifierPattern = () => true;
      let found: { iri: string; label: string }[] = [];

      harness.component['filter']('DTXSID7020182').subscribe((terms) => (found = terms));

      expect(harness.lookup.resolve).toHaveBeenCalledOnce();
      expect(found).toEqual([TERM]);
    });

    it('offers nothing for an identifier the authority does not have', () => {
      const harness = makeComponent({ resolved: { id: '', name: '', found: false } });
      harness.component.identifierPattern = () => true;
      let found: unknown[] = [];

      harness.component['filter']('DTXSID0000000').subscribe((terms) => (found = terms));

      expect(found).toEqual([]);
    });

    it('searches by name for anything else, keeping the words the query names', () => {
      const harness = makeComponent({
        results: [
          { iri: 'https://example.org/1', label: 'Mark A. Musen' },
          { iri: 'https://example.org/2', label: 'Someone Else' },
        ],
      });
      let found: { iri: string; label: string }[] = [];

      harness.component['filter']('Mark Musen').subscribe((terms) => (found = terms));

      expect(harness.lookup.search).toHaveBeenCalledOnce();
      expect(found.map((t) => t.label)).toEqual(['Mark A. Musen']);
    });

    it('offers nothing when the box already holds the term it would offer', () => {
      const harness = makeComponent({ results: [TERM] });
      harness.component.onSelectionChange(TERM);
      harness.component.setCurrentValue(TERM);
      let found: unknown[] = [];

      harness.component['filter'](harness.component.getCompoundValue(TERM)).subscribe((terms) => (found = terms));

      expect(harness.lookup.search).not.toHaveBeenCalled();
      expect(found).toEqual([]);
    });
  });

  describe('what it shows', () => {
    it('is empty until something is typed', () => {
      const { component } = makeComponent();
      expect(component.isEmpty).toBe(true);

      component.inputValueControl.setValue('x');
      expect(component.isEmpty).toBe(false);
    });

    it('counts whitespace as empty', () => {
      const { component } = makeComponent();
      component.inputValueControl.setValue('   ');

      expect(component.isEmpty).toBe(true);
    });

    it('renders a term as a value only when read-only and holding one', () => {
      const editable = makeComponent();
      editable.component.setCurrentValue(TERM);
      expect(editable.component.showsTermAsValue).toBe(false);

      const reading = makeComponent({ readOnly: true });
      expect(reading.component.showsTermAsValue).toBe(false);
      reading.component.setCurrentValue(TERM);
      expect(reading.component.showsTermAsValue).toBe(true);
    });

    it('addresses the term it holds, and nothing when it holds none', () => {
      const { component } = makeComponent();
      expect(component.detailsUrl).toBeNull();

      component.setCurrentValue(TERM);
      expect(component.detailsUrl).toBe(TERM.iri);
    });

    it('clears the box when the model has no term', () => {
      const { component } = makeComponent();
      component.setCurrentValue(TERM);

      component.setCurrentValue(null as never);

      expect(component.inputValueControl.value).toBe('');
      expect(component.selectedData).toBeNull();
    });
  });
});
