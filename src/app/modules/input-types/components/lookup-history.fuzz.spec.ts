import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Subject, map } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Command, commands, checkHistory, historySeeds } from '../../../../testing/seeded-history';
import { Reader, templateJson } from '../../shared/util/carried-answers.testing';
import { InstanceSerializer } from '../../shared/util/instance-serializer';
import { AbstractElementComponent } from '../../shared/models/element/abstract-element-component.model';
import { FieldComponent } from '../../shared/models/component/field-component.model';
import { AuthorityTerm } from '../../shared/models/authority/authority-search-response.model';
import { ActiveComponentRegistryService } from '../../shared/service/active-component-registry.service';
import { ComponentDataService } from '../../shared/service/component-data.service';
import { ControlledFieldDataService } from '../../shared/service/controlled-field-data.service';
import { ExternalAuthorityLookupService } from '../../shared/service/external-authority-lookup.service';
import { MessageHandlerService } from '../../shared/service/message-handler.service';
import { UserPreferencesService } from '../../shared/service/user-preferences.service';
import { CedarInputControlledComponent } from './cedar-input-controlled/cedar-input-controlled.component';
import { CedarInputOrcidComponent } from './cedar-input-orcid/cedar-input-orcid.component';

type Kind = 'controlled' | 'orcid';
type Widget = CedarInputControlledComponent | CedarInputOrcidComponent;
interface Request {
  editor: number;
  epoch: number;
  query: string;
  response: Subject<AuthorityTerm[]>;
  settled: boolean;
  term: AuthorityTerm;
}
interface Actor {
  reader: Reader;
  registry: ActiveComponentRegistryService;
  preferences: UserPreferencesService;
  widget: Widget;
  injector: ReturnType<typeof Injector.create>;
  field: FieldComponent;
  epoch: number;
  parent: number;
  child: number;
  readOnly: boolean;
  alive: boolean;
  values: (AuthorityTerm | null)[][];
  options: AuthorityTerm[];
  deliveries: number;
}
const fixture = (kind: Kind, revision = 0) =>
  templateJson(
    [{ key: 'group', multi: true, min: 2, max: 2, element: [{ kind, key: 'term', multi: true, min: 2, max: 2 }] }],
    { description: `revision ${revision}` },
  );
const fieldOf = (reader: Reader) => {
  const root = reader.coordinator.state.dataContext.templateRepresentation;
  if (!(root instanceof AbstractElementComponent)) throw new Error('Missing template');
  const group = root.getChildByName('group') as AbstractElementComponent;
  return group.getChildByName('term') as FieldComponent;
};
const INITIAL = { iri: 'https://orcid.org/0000-0002-1825-0097', label: 'Shared label' };

/** Real pagers, registry, handlers and RxJS pipeline; only the remote reply is
 * controlled. Equal text on different occurrences is intentional. */
function replay(kind: Kind, history: Command[]): void {
  vi.useFakeTimers();
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const requests: Request[] = [];
  const actors: Actor[] = [];
  const current = (request: Request) => {
    const actor = actors[request.editor];
    return actor.alive && !actor.readOnly && actor.epoch === request.epoch;
  };
  const model = (actor: Actor) =>
    InstanceSerializer.toJson(actor.reader.coordinator.state.dataContext.instanceFullData);
  const shown = (actor: Actor) => ({
    model: model(actor),
    options: actor.options,
    deliveries: actor.deliveries,
    text: actor.widget.inputValueControl.value,
    selected: actor.widget.selectedData,
    loading: actor.widget instanceof CedarInputControlledComponent ? actor.widget.loading : actor.widget.loadingOptions,
    failed: actor.widget.lookupFailed,
  });
  const destroy = (actor: Actor) => {
    actor.epoch++;
    actor.alive = false;
    actor.widget.ngOnDestroy();
    actor.injector.destroy();
  };
  const sync = (actor: Actor) => {
    actor.epoch++;
    actor.reader.turn(['group'], actor.parent).turn(['group', actor.parent, 'term'], actor.child);
    actor.registry.updateViewToModel(actor.field, actor.reader.coordinator.state.handlerContext);
    expect(actor.options, 'model-to-view changes retire suggestions from the preceding context').toEqual([]);
    expect(actor.widget.selectedData, 'paging displays the addressed term').toEqual(
      actor.values[actor.parent][actor.child],
    );
  };
  const mount = (actor: Actor, editor: number) => {
    actor.injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: actor.preferences },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: actor.registry },
      ],
    });
    const responseFor = (query: string) => {
      const response = new Subject<AuthorityTerm[]>();
      requests.push({
        editor,
        epoch: actor.epoch,
        query,
        response,
        settled: false,
        term: { iri: `https://orcid.org/result-${requests.length}`, label: `${query} result` },
      });
      return response;
    };
    actor.widget = runInInjectionContext(actor.injector, () =>
      kind === 'controlled'
        ? new CedarInputControlledComponent(
            new FormBuilder(),
            new ComponentDataService(),
            actor.registry,
            { getData: responseFor } as unknown as ControlledFieldDataService,
            { errorObject: vi.fn() } as unknown as MessageHandlerService,
          )
        : new CedarInputOrcidComponent(new FormBuilder(), new ComponentDataService(), actor.registry, {
            search: (_type: unknown, query: string) => responseFor(query).pipe(map((results) => ({ results }))),
          } as unknown as ExternalAuthorityLookupService),
    );
    actor.field = fieldOf(actor.reader);
    actor.widget.componentToRender = actor.field;
    actor.widget.handlerContext = actor.reader.coordinator.state.handlerContext;
    actor.alive = true;
    actor.widget.ngOnInit();
    actor.widget.filteredOptions.subscribe((options) => {
      actor.options = options;
      actor.deliveries++;
    });
    sync(actor);
  };
  const settle = (request: Request, outcome: number) => {
    const live = current(request);
    const before = structuredClone(actors.map(shown));
    request.settled = true;
    if (outcome === 1) request.response.error(new Error('Scheduled lookup failure'));
    else {
      if (outcome === 0) request.response.next([request.term]);
      request.response.complete();
    }
    if (!live)
      expect(actors.map(shown), 'obsolete reply changes neither editor nor visible lookup state').toEqual(before);
    else {
      const actor = actors[request.editor];
      if (outcome === 0) expect(actor.options, 'latest successful reply is visible').toEqual([request.term]);
      if (outcome === 1) expect(actor.widget.lookupFailed, 'latest failed reply is reported').toBe(true);
      expect(shown(actor).loading, 'settled lookup releases its spinner').toBe(false);
      expect(model(actor), 'a lookup response does not write an answer').toEqual(before[request.editor].model);
      expect(shown(actors[1 - request.editor]), 'lookup ownership is editor-local').toEqual(before[1 - request.editor]);
    }
  };
  const verify = () => {
    actors.forEach((actor) => {
      const output = model(actor) as { group: { term: Record<string, unknown>[] }[] };
      expect(
        output.group.map((group) => group.term.map((term) => term['@id'] ?? null)),
        'only selection writes to its addressed occurrence',
      ).toEqual(actor.values.map((group) => group.map((term) => term?.iri ?? null)));
    });
    for (const request of requests.filter((request) => !request.settled)) {
      expect(
        request.response.observed,
        'requests lose their subscriber as soon as their occurrence, query or template is superseded',
      ).toBe(current(request));
    }
  };
  try {
    for (let editor = 0; editor < 2; editor++) {
      const reader = new Reader().open(fixture(kind));
      const actor = {
        reader,
        registry: new ActiveComponentRegistryService(),
        preferences: new UserPreferencesService(),
        epoch: 0,
        parent: 0,
        child: 0,
        readOnly: false,
        alive: false,
        values: [
          [null, INITIAL],
          [INITIAL, null],
        ],
        options: [],
        deliveries: 0,
      } as unknown as Actor;
      actors.push(actor);
      const field = fieldOf(reader);
      for (let parent = 0; parent < 2; parent++)
        for (let child = 0; child < 2; child++) {
          reader.turn(['group'], parent).turn(['group', parent, 'term'], child);
          const value = actor.values[parent][child];
          reader.coordinator.state.handlerContext.changeControlledValue(
            field,
            value?.iri ?? null,
            value?.label ?? null,
          );
        }
      mount(actor, editor);
    }
    for (const [serial, command] of history.entries()) {
      const editor = command.a % 2;
      const actor = actors[editor];
      if (command.op === 0 && actor.alive && !actor.readOnly) {
        const text =
          command.b % 4 === 3
            ? kind === 'controlled'
              ? INITIAL.label
              : `${INITIAL.label} - ${INITIAL.iri}`
            : `query ${command.b % 3}`;
        if (text !== actor.widget.inputValueControl.value) actor.epoch++;
        actor.widget.inputValueControl.setValue(text);
      } else if (command.op === 1) {
        vi.advanceTimersByTime([0, 1, 399, 400, 800][command.b % 5]);
      } else if (command.op >= 2 && command.op <= 4) {
        const pending = requests.filter((request) => !request.settled);
        if (pending.length) settle(pending[command.c % pending.length], command.op - 2);
      } else if ((command.op === 5 || command.op === 6) && actor.alive) {
        if (command.op === 5) actor.child = 1 - actor.child;
        else actor.parent = 1 - actor.parent;
        sync(actor);
      } else if (command.op === 7 && actor.alive) {
        actor.epoch++;
        actor.readOnly = !actor.readOnly;
        actor.reader.coordinator.state.handlerContext.readOnlyMode = actor.readOnly;
        actor.preferences.setReadOnlyMode(actor.readOnly);
      } else if (command.op === 8 && actor.alive) {
        const reuse = command.b % 2 === 0;
        if (!reuse) destroy(actor);
        actor.reader.open(fixture(kind, serial + 1));
        actor.reader.coordinator.state.handlerContext.readOnlyMode = actor.readOnly;
        if (reuse) {
          actor.field = fieldOf(actor.reader);
          actor.widget.handlerContext = actor.reader.coordinator.state.handlerContext;
          actor.widget.componentToRender = actor.field;
          sync(actor);
        } else mount(actor, editor);
      } else if (command.op === 9 && actor.alive && !actor.readOnly) {
        const offered = requests.find((request) => current(request) && actor.options.includes(request.term));
        if (offered) {
          actor.widget.onSelectionChange(offered.term, { isUserInput: true });
          actor.values[actor.parent][actor.child] = offered.term;
          sync(actor);
        }
      } else if (command.op === 10 && actor.alive && !actor.readOnly) {
        actor.widget.clearValue();
        actor.values[actor.parent][actor.child] = null;
        sync(actor);
      } else if (command.op === 11) {
        if (actor.alive) destroy(actor);
        else mount(actor, editor);
      }
      verify();
    }
    vi.advanceTimersByTime(800);
    for (const request of [...requests].reverse()) if (!request.settled) settle(request, 0);
    verify();
  } finally {
    actors.forEach((actor) => {
      if (actor.alive) destroy(actor);
    });
    vi.clearAllTimers();
    vi.useRealTimers();
    errors.mockRestore();
  }
}

for (const kind of ['controlled', 'orcid'] as const)
  describe(`${kind} lookup scheduling histories`, () => {
    it.each(historySeeds(100))('seed %i', (seed) =>
      checkHistory(seed, commands(seed, 60, 12), (history) => replay(kind, history)),
    );
  });

for (const kind of ['controlled', 'orcid'] as const)
  it(`${kind}: equal labels do not keep the preceding occurrence request alive`, () =>
    replay(kind, [
      { op: 0, a: 0, b: 3, c: 0 },
      { op: 1, a: 0, b: 4, c: 0 },
      { op: 5, a: 0, b: 0, c: 0 },
    ]));
