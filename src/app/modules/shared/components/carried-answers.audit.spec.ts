import { Reader, templateJson, FieldSpec, ChildSpec } from '../util/carried-answers.testing';
import { MultiComponent } from '../models/component/multi-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import { Injector, runInInjectionContext, ChangeDetectorRef } from '@angular/core';
import { vi } from 'vitest';
import { CedarInputDatetimeComponent } from '../../input-types/components/cedar-input-datetime/cedar-input-datetime.component';
import { ActiveComponentRegistryService } from '../service/active-component-registry.service';
import { ComponentDataService } from '../service/component-data.service';
import { UserPreferencesService } from '../service/user-preferences.service';

const text = (key: string, more: Partial<FieldSpec> = {}): FieldSpec => ({ kind: 'text', key, ...more });
const open = (children: ChildSpec[]) => new Reader().open(templateJson(children));

describe('independent carry-over audit regressions', () => {
  it('does not resurrect a default occurrence explicitly deleted by the reader', () => {
    const fields = [text('tags', { multi: true, default: 'Default' })];
    const r = open(fields);
    const s = r.coordinator.state;
    const field = s.dataContext.templateRepresentation!.getChildByName('tags')!;
    expect(s.handlerContext.deleteMultiInstance(field as MultiComponent)).toBe(true);
    expect(r.values(['tags'])).toEqual([]);
    r.open(templateJson(fields, { description: 'description only' }));
    expect(r.values(['tags'])).toEqual([]);
  });

  it('keeps the pager position on untouched minimum occurrences', () => {
    const fields = [text('tags', { multi: true, min: 3 })];
    const r = open(fields).turn(['tags'], 2);
    r.open(templateJson(fields, { description: 'description only' }));
    expect(r.cursor(['tags'])).toBe(2);
  });

  it('keeps user ownership when an intermediate default coincides with their answer', () => {
    const r = open([text('name', { default: 'old' })]).type(['name'], 'mine');
    r.open(templateJson([text('name', { default: 'mine' })]));
    expect(r.value(['name'])).toBe('mine');
    r.open(templateJson([text('name', { default: 'new' })]));
    expect(r.value(['name'])).toBe('mine');
  });

  it('keeps an existing unfinished answer through a property-IRI-preserving rename', () => {
    const iri = 'https://example.org/email';
    const r = open([{ kind: 'email', key: 'old', iri }]).type(['old'], 'unfinished');
    expect(r.errors()).toHaveLength(1);
    r.open(templateJson([{ kind: 'email', key: 'renamed', iri }]));
    expect(r.value(['renamed'])).toBe('unfinished');
  });

  it('withdraws only the bad occurrence rather than its valid sibling answers', () => {
    const fields = (defaultValue?: string): ChildSpec[] => [
      { key: 'people', multi: true, element: [text('tags', { multi: true, maxLength: 4, default: defaultValue })] },
    ];
    const r = open(fields()).add(['people']).add(['people', 0, 'tags'], 2).type(['people', 0, 'tags', 0], 'keep');
    r.open(templateJson(fields('Final')));
    expect(r.errors()).toEqual([]);
    expect(r.values(['people', 0, 'tags'])).toContain('keep');
  });

  it('does not excuse a new invalid default in another occurrence with an existing error', () => {
    const fields = (defaultValue?: string): ChildSpec[] => [
      { key: 'people', multi: true, element: [text('name', { maxLength: 4, default: defaultValue })] },
    ];
    const r = open(fields()).add(['people'], 2).type(['people', 0, 'name'], 'unfinished');
    expect(r.errors()).toHaveLength(1);
    r.open(templateJson(fields('Final')));
    expect(r.value(['people', 0, 'name'])).toBe('unfinished');
    expect(r.errors()).toHaveLength(1);
  });

  it('retains a temporal widget draft during an unchanged-template replacement', () => {
    const fields: ChildSpec[] = [
      { kind: 'temporal', key: 'date', temporalType: 'xsd:dateTime', granularity: 'minute' },
    ];
    const r = open(fields);
    const s = r.coordinator.state;
    const field = s.dataContext.templateRepresentation!.getChildByName('date') as FieldComponent;
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: new UserPreferencesService() },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: registry },
        { provide: ComponentDataService, useValue: new ComponentDataService() },
      ],
    });
    const widget = runInInjectionContext(injector, () => new CedarInputDatetimeComponent(registry));
    widget.componentToRender = field;
    widget.handlerContext = s.handlerContext;
    widget.dateInputChanged(new Date(2026, 9, 9));
    const draft = s.handlerContext.validation.draftFor(field);
    expect(draft?.code).toBe('incompleteValue');
    expect(r.value(['date'])).toBeNull();
    r.open(templateJson(fields, { description: 'description only' }));
    const next = r.coordinator.state;
    const nextField = next.dataContext.templateRepresentation!.getChildByName('date') as FieldComponent;
    expect(next.handlerContext.validation.draftFor(nextField)).toEqual(draft);
  });

  it('does not promote padded year precision to an actual January 1 answer', () => {
    const r = open([{ kind: 'temporal', key: 'date', granularity: 'year' }]).type(['date'], '2026-01-01');
    expect(r.errors()).toEqual([]);
    r.open(templateJson([{ kind: 'temporal', key: 'date', granularity: 'day' }]));
    expect(r.value(['date'])).toBeNull();
  });

  it('follows new defaults for an untouched added occurrence inserted before a seeded empty one', () => {
    const fields = (d: string) => [text('tags', { multi: true, min: 2, default: d })];
    const r = open(fields('old')).turn(['tags'], 0).add(['tags']);
    expect(r.values(['tags'])).toEqual(['old', 'old', null]);
    r.open(templateJson(fields('new')));
    expect(r.values(['tags'])).toEqual(['new', 'new', null]);
  });

  it('retains an unnamed attribute draft through an unchanged-template replacement', () => {
    const fields: ChildSpec[] = [{ kind: 'attribute', key: 'extra' }];
    const r = open(fields).add(['extra']);
    const s = r.coordinator.state;
    const field = s.dataContext.templateRepresentation!.getChildByName('extra') as FieldComponent;
    s.handlerContext.changeAttributeValue(field, null, 'typed but not named');
    const draft = s.handlerContext.validation.draftFor(field);
    expect(draft).not.toBeNull();
    r.open(templateJson(fields, { description: 'description only' }));
    const next = r.coordinator.state;
    const nextField = next.dataContext.templateRepresentation!.getChildByName('extra') as FieldComponent;
    expect(next.handlerContext.validation.draftFor(nextField)).toEqual(draft);
  });

  it('preserves three levels of nested answers and cursors through renames and trimming', () => {
    const fields = (renamed = false): ChildSpec[] => [
      {
        key: renamed ? 'renamed' : 'outer',
        iri: 'https://example.org/outer',
        multi: true,
        max: renamed ? 1 : null,
        element: [
          { key: 'middle', element: [{ key: 'inner', multi: true, element: [text('tags', { multi: true })] }] },
        ],
      },
    ];
    const r = open(fields())
      .add(['outer'], 2)
      .add(['outer', 1, 'middle', 'inner'], 2)
      .add(['outer', 1, 'middle', 'inner', 1, 'tags'], 2)
      .type(['outer', 1, 'middle', 'inner', 1, 'tags', 1], 'survives');
    r.open(templateJson(fields(true)));
    expect(r.count(['renamed'])).toBe(1);
    expect(r.value(['renamed', 0, 'middle', 'inner', 1, 'tags', 1])).toBe('survives');
    expect(r.cursor(['renamed', 0, 'middle', 0, 'inner'])).toBe(1);
    expect(r.cursor(['renamed', 0, 'middle', 0, 'inner', 1, 'tags'])).toBe(1);
    expect(r.errors()).toEqual([]);
    r.type(['renamed', 0, 'middle', 'inner', 1, 'tags', 1], 'editable');
    expect(r.value(['renamed', 0, 'middle', 'inner', 1, 'tags', 1])).toBe('editable');
  });

  it('best effort should isolate an unsalvageable optional branch instead of clearing unrelated answers', () => {
    const fields = (bad = false): ChildSpec[] => [
      text('title'),
      { key: 'people', multi: true, element: [text('name', bad ? { regex: '[' } : {})] },
    ];
    const r = open(fields()).type(['title'], 'unrelated answer').add(['people']).type(['people', 0, 'name'], 'Ada');
    r.open(templateJson(fields(true)));
    expect(r.errors()).toEqual([]);
    expect(r.value(['title'])).toBe('unrelated answer');
  });
});
