/** Cross host ownership and ordering with concurrent controllers and asynchronous widget work.
 * Angular rendering is covered by the coordinator suite; only rendering/HTTP are replaced here.
 */
import { ChangeDetectorRef, ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { CedarBuilders, CedarWriters } from 'cedar-model-typescript-library';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import type {
  CedarEmbeddableFieldChangeDetail,
  CedarEmbeddableFieldValue,
  CeeJsonObject,
} from '../../../cee-public-api';
import { CedarEmbeddableFieldWrapperComponent as FieldWrapper } from '../components/cedar-embeddable-field-wrapper/cedar-embeddable-field-wrapper.component';
import { CedarInputControlledComponent } from '../../input-types/components/cedar-input-controlled/cedar-input-controlled.component';
import { ActiveComponentRegistryService } from '../service/active-component-registry.service';
import { ComponentDataService } from '../service/component-data.service';
import { ControlledFieldDataService } from '../service/controlled-field-data.service';
import { MessageHandlerService } from '../service/message-handler.service';
import { UserPreferencesService } from '../service/user-preferences.service';
import { FieldComponent } from '../models/component/field-component.model';
import { AuthorityTerm } from '../models/authority/authority-search-response.model';
import { ArtifactInputCoordinator } from '../util/artifact-input-coordinator';
import { InstanceSerializer } from '../util/instance-serializer';
import templateFixture from '../../../../../visual/fixtures/04-controlled-terms.json';
import instanceFixture from '../../../../../visual/fixtures/04-controlled-terms-instance.json';

type Arguments = ConstructorParameters<typeof FieldWrapper>;
const createField = () => {
  const host = document.createElement('div');
  const registry = { clear: vi.fn(), unregisterComponent: vi.fn() } as unknown as Arguments[2];
  const messages = { error: vi.fn(), trace: vi.fn(), traceGroup: vi.fn(), ready: vi.fn() };
  const preferences = new UserPreferencesService();
  const detector = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
  const wrapper = new FieldWrapper(
    new ElementRef(host),
    detector,
    registry,
    {} as Arguments[3],
    {} as Arguments[4],
    { languageMapPathPrefix: null } as Arguments[5],
    messages as unknown as Arguments[6],
    { schedule: async () => false } as unknown as Arguments[7],
    { setTrustTemplateRichText: vi.fn() } as unknown as Arguments[8],
    { getLangs: () => [], setFallbackLang: vi.fn(), use: vi.fn() } as unknown as Arguments[9],
    preferences,
  );
  const events: CedarEmbeddableFieldChangeDetail[] = [];
  host.addEventListener('valueChange', (event) => events.push(structuredClone((event as CustomEvent).detail)));
  wrapper.ngOnInit();
  return { wrapper, host, events, messages, preferences, registry, detector };
};

const numericModel = CedarBuilders.numericFieldBuilder().withSchemaName('Exact number').build();
const numericArtifact = JSON.parse(
  JSON.stringify(CedarWriters.json().getStrict().getFieldWriterForField(numericModel).getAsJsonNode(numericModel)),
) as CeeJsonObject;
const controlledArtifact = templateFixture.properties._organism as unknown as CeeJsonObject;
const precisionCases = [
  { name: 'ordinary', first: '1.5', next: '2.5', expected: 2.5 },
  { name: 'long', first: '9007199254740992', next: '9007199254740993', expected: '9007199254740993' },
  { name: 'decimal', first: '0.1234567890123456788', next: '0.1234567890123456789', expected: '0.1234567890123456789' },
] as const;
const cases = (['value-first', 'field-first', 'config-first'] as const).flatMap((order) =>
  [false, true].flatMap((mutate) =>
    [1, 2].flatMap((pairs) =>
      precisionCases.flatMap((precision) =>
        (['editable', 'read-only', 'late-read-only'] as const).flatMap((mode) =>
          (['success', 'error', 'complete'] as const).map((settlement) => ({
            order,
            mutate,
            pairs,
            precision,
            mode,
            settlement,
          })),
        ),
      ),
    ),
  ),
);

it.each(cases)('$order mutation=$mutate pairs=$pairs $precision.name $mode stale=$settlement', (row) => {
  vi.useFakeTimers();
  const cleanups: (() => void)[] = [];
  try {
    const mounts = Array.from({ length: row.pairs }, () => ({ numeric: createField(), term: createField() }));
    for (const { numeric, term } of mounts) {
      for (const mounted of [numeric, term]) cleanups.push(() => mounted.wrapper.ngOnDestroy());
      const sourceValue: CedarEmbeddableFieldValue = { kind: 'number', value: row.precision.first };
      const sourceArtifact = structuredClone(numericArtifact);
      const config = { readOnlyMode: row.mode === 'read-only' };
      const assignFields = () => {
        numeric.wrapper.fieldObject = sourceArtifact;
        term.wrapper.fieldObject = structuredClone(controlledArtifact);
      };
      if (row.order === 'config-first') {
        numeric.wrapper.config = config;
        term.wrapper.config = config;
      }
      if (row.order === 'value-first') numeric.wrapper.value = sourceValue;
      assignFields();
      if (row.order !== 'value-first') numeric.wrapper.value = sourceValue;
      if (row.mode !== 'late-read-only' && row.order !== 'config-first') {
        numeric.wrapper.config = config;
        term.wrapper.config = config;
      }
      if (row.mutate) {
        sourceValue.value = '77';
        sourceArtifact['schema:name'] = 'Host mutation';
        config.readOnlyMode = !config.readOnlyMode;
        Object.assign(numeric.wrapper.currentValue, { value: '77' });
        numeric.host.addEventListener('valueChange', (event) => {
          Object.assign((event as CustomEvent<CedarEmbeddableFieldChangeDetail>).detail.value, {
            value: row.precision.first,
          });
        });
      }
      expect(numeric.wrapper.handlerContext.readOnlyMode).toBe(row.mode === 'read-only');
      const field = numeric.wrapper.renderedComponent as FieldComponent;
      const before = numeric.wrapper.currentValue;

      // CEE pairs the same two artifacts in the corresponding arrival order.
      const coordinator = new ArtifactInputCoordinator(numeric.messages as unknown as MessageHandlerService);
      const template = structuredClone(templateFixture) as unknown as CeeJsonObject;
      const instance = structuredClone(instanceFixture) as unknown as CeeJsonObject;
      if (row.order === 'value-first') coordinator.acceptInstance(instance);
      else if (row.order === 'field-first') coordinator.acceptTemplate(template);
      else coordinator.acceptCombined({ templateObject: template, instanceObject: instance });
      if (row.mutate) {
        template['schema:name'] = 'Host mutation';
        instance['_organism'] = { '@id': 'urn:host-mutation' };
      }
      if (row.order === 'value-first') coordinator.acceptTemplate(templateFixture as unknown as CeeJsonObject);
      if (row.order === 'field-first') coordinator.acceptInstance(instanceFixture as unknown as CeeJsonObject);
      const written = InstanceSerializer.toJson(coordinator.state.dataContext.instanceFullData) as CeeJsonObject;
      expect(written['_organism']).toEqual(instanceFixture._organism);
      const acceptedTemplate =
        coordinator.state.templateAndInstanceJson?.templateObject ?? coordinator.state.templateJson;
      expect(acceptedTemplate?.['schema:name']).toBe(templateFixture['schema:name']);

      const injector = Injector.create({
        providers: [
          { provide: UserPreferencesService, useValue: term.preferences },
          { provide: ChangeDetectorRef, useValue: term.detector },
          { provide: ActiveComponentRegistryService, useValue: term.registry },
        ],
      });
      cleanups.push(() => injector.destroy());
      const widget = runInInjectionContext(
        injector,
        () =>
          new CedarInputControlledComponent(
            new FormBuilder(),
            {} as ComponentDataService,
            term.registry,
            {} as ControlledFieldDataService,
            term.messages as unknown as MessageHandlerService,
          ),
      );
      widget.component = term.wrapper.renderedComponent as FieldComponent;
      widget.handlerContext = term.wrapper.handlerContext;
      const requests: Subject<AuthorityTerm[]>[] = [];
      vi.spyOn(widget, 'filter').mockImplementation(() => {
        const response = new Subject<AuthorityTerm[]>();
        requests.push(response);
        return response;
      });
      widget.ngOnInit();
      const delivered: AuthorityTerm[][] = [];
      widget.filteredOptions.subscribe((terms) => delivered.push(terms));
      widget.inputValueControl.setValue('old');
      vi.advanceTimersByTime(400);
      const old = requests[0];
      if (row.mode === 'late-read-only') {
        // Config is set once: a host may deliver its first config after the field and an active request.
        if (row.order === 'config-first') {
          // Exercise the controller transition directly when config has already been assigned.
          // The public config remains set-once.
          term.wrapper.handlerContext.enableReadOnlyMode();
          term.preferences.setReadOnlyMode(true);
          numeric.wrapper.handlerContext.enableReadOnlyMode();
        } else {
          numeric.wrapper.config = { readOnlyMode: true };
          term.wrapper.config = { readOnlyMode: true };
        }
      }
      widget.inputValueControl.setValue('new');
      if (old) {
        expect(old.observed).toBe(false);
        if (row.settlement === 'success') old.next([{ iri: 'urn:stale', label: 'Stale' }]);
        if (row.settlement === 'error') old.error(new Error('Superseded failure'));
        if (row.settlement === 'complete') old.complete();
      }
      vi.advanceTimersByTime(400);
      expect(delivered.flat()).toEqual([]);
      expect(widget.lookupFailed).toBe(false);
      if (row.mode === 'editable') {
        requests.at(-1)!.next([{ iri: 'urn:latest', label: 'Latest' }]);
        requests.at(-1)!.complete();
        expect(delivered.at(-1)).toEqual([{ iri: 'urn:latest', label: 'Latest' }]);
      } else {
        expect(requests.length).toBe(row.mode === 'read-only' ? 0 : 1);
      }
      expect(widget.loading).toBe(false);

      numeric.wrapper.handlerContext.changeValue(field, row.precision.next);
      if (row.mode === 'editable') {
        expect(numeric.wrapper.currentValue).toEqual({ kind: 'number', value: row.precision.expected });
        numeric.wrapper.handlerContext.changeValue(field, row.precision.first);
        expect(numeric.events).toHaveLength(2);
      } else {
        expect(numeric.wrapper.currentValue).toEqual(before);
        expect(numeric.events).toEqual([]);
      }
      numeric.wrapper.value = { kind: 'number', value: row.precision.next };
      expect(numeric.wrapper.currentValue).toEqual({ kind: 'number', value: row.precision.expected });
      expect(term.wrapper.currentValue).toEqual({ kind: 'none' });
      expect(numeric.messages.error).not.toHaveBeenCalled();
    }
    expect(mounts.map(({ numeric }) => numeric.wrapper.currentValue)).toEqual(
      Array.from({ length: row.pairs }, () => ({ kind: 'number', value: row.precision.expected })),
    );
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
    vi.useRealTimers();
  }
});
