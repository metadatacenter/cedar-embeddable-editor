import { describe, expect, it } from 'vitest';
import { Command, commands, checkHistory, historySeeds } from '../../../../testing/seeded-history';
import { ChildSpec, Reader, Step, templateJson } from './carried-answers.testing';
import { InstanceSerializer } from './instance-serializer';
import { AbstractElementComponent } from '../models/element/abstract-element-component.model';
import { MultiComponent } from '../models/component/multi-component.model';

interface Reference {
  label: string | null;
  values: (string | null)[];
  groups: Reference[];
  depth: number;
}
interface List {
  place: Step[];
  owner: Reference;
  field: boolean;
  minimum: number;
  maximum: number;
}

function replay(seed: number, history: Command[]): void {
  const depthLimit = 1 + (seed % 3);
  const fieldMin = seed % 3;
  const groupMin = (seed >>> 2) % 2;
  const repeating = (depth: number) => ((seed >>> depth) & 1) === 1;
  const declarations = (depth: number): ChildSpec[] => [
    { key: 'label', kind: 'text' },
    { key: 'values', kind: 'text', multi: true, min: fieldMin, max: 4 },
    ...(depth < depthLimit
      ? [
          {
            key: 'group',
            element: declarations(depth + 1),
            multi: repeating(depth),
            min: repeating(depth) ? groupMin : null,
            max: repeating(depth) ? 3 : null,
          },
        ]
      : []),
  ];
  const fresh = (depth: number): Reference => ({
    depth,
    label: null,
    values: Array.from({ length: fieldMin }, () => null),
    groups: depth < depthLimit ? Array.from({ length: repeating(depth) ? groupMin : 1 }, () => fresh(depth + 1)) : [],
  });
  const reference = fresh(0);
  const template = templateJson(declarations(0));
  const reader = new Reader().open(template);
  // A separate editor detects accidental global/shared mutation as well as aliasing within copies.
  const other = new Reader().open(template);
  const serialize = (r: Reader) =>
    InstanceSerializer.toJson(r.coordinator.state.dataContext.instanceFullData) as Record<string, unknown>;
  const untouched = serialize(other);
  const lists = (node: Reference, place: Step[] = []): List[] => [
    { place: [...place, 'values'], owner: node, field: true, minimum: fieldMin, maximum: 4 },
    ...(node.depth < depthLimit && repeating(node.depth)
      ? [{ place: [...place, 'group'], owner: node, field: false, minimum: groupMin, maximum: 3 }]
      : []),
    ...node.groups.flatMap((child, index) =>
      lists(child, [...place, 'group', ...(repeating(node.depth) ? [index] : [])]),
    ),
  ];
  const expected = (node: Reference): Record<string, unknown> => ({
    label: { '@value': node.label },
    values: node.values.map((value) => ({ '@value': value })),
    ...(node.depth < depthLimit
      ? { group: repeating(node.depth) ? node.groups.map(expected) : expected(node.groups[0]) }
      : {}),
  });
  const actual = (node: Record<string, unknown>, depth = 0): Record<string, unknown> => ({
    label: node['label'],
    values: node['values'],
    ...(depth < depthLimit
      ? {
          group: repeating(depth)
            ? (node['group'] as Record<string, unknown>[]).map((child) => actual(child, depth + 1))
            : actual(node['group'] as Record<string, unknown>, depth + 1),
        }
      : {}),
  });
  const component = (place: Step[]): MultiComponent => {
    const root = reader.coordinator.state.dataContext.templateRepresentation;
    if (!(root instanceof AbstractElementComponent)) throw new Error('Missing template');
    let current: AbstractElementComponent = root;
    let found;
    for (const step of place) {
      if (typeof step === 'number') continue;
      found = current.getChildByName(step)!;
      if (found instanceof AbstractElementComponent) current = found;
    }
    return found as MultiComponent;
  };
  for (const command of history) {
    const targets = lists(reference);
    const target = targets[command.a % targets.length];
    const held = target.field ? target.owner.values : target.owner.groups;
    const index = held.length ? command.b % held.length : -1;
    reader.turn(target.place, index);
    const handler = reader.coordinator.state.handlerContext;
    const comp = component(target.place);
    const before = serialize(reader);
    let cursor = index;
    if (command.op < 3) {
      const accepted =
        command.op === 0
          ? handler.addMultiInstance(comp)
          : command.op === 1
            ? handler.copyMultiInstance(comp)
            : handler.deleteMultiInstance(comp);
      const allowed =
        !handler.readOnlyMode && (command.op === 2 ? held.length > target.minimum : held.length < target.maximum);
      expect(accepted, 'bounds and read-only acceptance').toBe(allowed);
      if (!allowed) expect(serialize(reader), 'refused operation is atomic').toEqual(before);
      else if (command.op === 2) {
        held.splice(index, 1);
        cursor = Math.min(index, held.length - 1);
      } else {
        if (target.field)
          target.owner.values.splice(index + 1, 0, command.op === 1 && index >= 0 ? target.owner.values[index] : null);
        else
          target.owner.groups.splice(
            index + 1,
            0,
            command.op === 1 && index >= 0
              ? structuredClone(target.owner.groups[index])
              : fresh(target.owner.depth + 1),
          );
        cursor = index + 1;
      }
    } else if (command.op === 3 && target.field && index >= 0) {
      const value = command.c % 4 ? `text:${command.c}` : null;
      reader.type([...target.place, index], value);
      if (!handler.readOnlyMode) target.owner.values[index] = value;
    } else if (command.op === 4) {
      const value = command.c % 3 ? `label:${command.c}` : null;
      reader.type([...target.place.slice(0, -1), 'label'], value);
      if (!handler.readOnlyMode) target.owner.label = value;
    } else if (command.op === 5) {
      handler.readOnlyMode = !handler.readOnlyMode;
    } else if (command.op === 6) {
      // Navigation is allowed in read-only mode and never writes data.
      expect(serialize(reader), 'navigation leaves data unchanged').toEqual(before);
    }
    const info = handler.multiInstanceObjectService.getMultiInstanceInfoForComponent(comp)!;
    expect(info.currentCount, 'pager count follows actual occurrence list').toBe(held.length);
    expect(info.currentIndex, 'pager follows edited occurrence').toBe(cursor);
    expect(actual(serialize(reader)), 'all values match independent occurrence model').toEqual(expected(reference));
    expect(serialize(other), 'other editor is isolated').toEqual(untouched);
    expect(reader.errors(), 'valid operations introduce no validation errors').toEqual([]);
    expect(reader.error).not.toHaveBeenCalled();
  }
}

describe('seeded CEE occurrence histories', () => {
  it.each(historySeeds())('seed %i', (seed) =>
    checkHistory(seed, commands(seed, 60, 7), (history) => replay(seed, history)),
  );
});

/** Attribute names live in arrays but their values live beside those arrays.
 * Two groups deliberately compete for the same name pool. */
function replayAttributes(history: Command[]): void {
  const reader = new Reader().open(
    templateJson([
      { kind: 'text', key: 'sentinel', default: 'untouched' },
      { kind: 'attribute', key: 'a', max: 4 },
      { kind: 'attribute', key: 'b', max: 4 },
    ]),
  );
  const serialize = () =>
    InstanceSerializer.toJson(reader.coordinator.state.dataContext.instanceFullData) as Record<string, unknown>;
  const baselineKeys = new Set(Object.keys(serialize()));
  const groups: Record<string, { name: string; value: string | null }[]> = { a: [], b: [] };
  for (const command of history) {
    const key = command.a % 2 ? 'a' : 'b';
    const slots = groups[key];
    const index = slots.length ? command.b % slots.length : -1;
    const handler = reader.coordinator.state.handlerContext;
    const component = reader.coordinator.state.dataContext.templateRepresentation!.getChildByName(
      key,
    ) as MultiComponent;
    reader.turn([key], index);
    const before = serialize();
    const names = () =>
      Object.values(groups)
        .flat()
        .map((slot) => slot.name)
        .filter(Boolean);
    if (command.op < 3) {
      const accepted =
        command.op === 0
          ? handler.addMultiInstance(component)
          : command.op === 1
            ? handler.copyMultiInstance(component)
            : handler.deleteMultiInstance(component);
      const allowed = command.op === 2 ? slots.length > 0 : slots.length < 4;
      expect(accepted, 'attribute cardinality').toBe(allowed);
      if (allowed && command.op === 2) slots.splice(index, 1);
      else if (allowed) {
        const source = command.op === 1 && index >= 0 ? slots[index] : { name: '', value: null };
        let name = source.name;
        if (name) {
          let suffix = 1;
          while (names().includes(`${source.name} copy${suffix === 1 ? '' : ` ${suffix}`}`)) suffix++;
          name = `${source.name} copy${suffix === 1 ? '' : ` ${suffix}`}`;
        }
        slots.splice(index + 1, 0, { name, value: source.value });
      } else expect(serialize(), 'refused attribute edit is atomic').toEqual(before);
    } else if (index >= 0) {
      const name = ['', '@id', 'sentinel', 'attr0', 'attr1', 'attr2', 'attr0 copy'][command.c % 7];
      const value = `value:${command.b}`;
      const old = slots[index];
      const accepted = !name || (!['@id', 'sentinel'].includes(name) && (name === old.name || !names().includes(name)));
      const field = component as import('../models/component/field-component.model').FieldComponent;
      const error = handler.changeAttributeValue(field, name, value);
      expect(error === null, 'attribute name acceptance').toBe(accepted);
      if (accepted) slots[index] = { name, value: name ? value : null };
      else expect(serialize(), 'rejected name preserves previous value').toEqual(before);
    }
    const written = serialize();
    for (const key of ['a', 'b']) {
      expect(reader.values([key]), 'attribute slots stay in order').toEqual(groups[key].map((slot) => slot.name));
      expect(written[key], 'export includes named slots only').toEqual(
        groups[key].map((slot) => slot.name).filter(Boolean),
      );
    }
    expect(written['sentinel'], 'declared sibling never overwritten').toEqual({ '@value': 'untouched' });
    const expected = Object.fromEntries(
      Object.values(groups)
        .flat()
        .filter((slot) => slot.name)
        .map((slot) => [slot.name, { '@value': slot.value }]),
    );
    expect(
      Object.fromEntries(Object.entries(written).filter(([key]) => !baselineKeys.has(key))),
      'no orphaned attribute values',
    ).toEqual(expected);
    expect(reader.error).not.toHaveBeenCalled();
  }
}

describe('seeded CEE attribute ownership histories', () => {
  it.each(historySeeds(120))('seed %i', (seed) => checkHistory(seed, commands(seed, 40, 5), replayAttributes));
});

it('deleting the last parent preserves the preceding parent’s nested pager state', () => {
  const r = new Reader().open(
    templateJson([
      {
        key: 'people',
        multi: true,
        min: 1,
        element: [
          {
            key: 'children',
            multi: true,
            min: 1,
            element: [{ key: 'value', kind: 'text', multi: true, min: 1 }],
          },
        ],
      },
    ]),
  );
  r.copy(['people', 0, 'children']);
  r.type(['people', 0, 'children', 1, 'value', 0], 'retained');
  r.add(['people']).remove(['people']);
  expect(r.count(['people', 0, 'children'])).toBe(2);
  expect(r.cursor(['people', 0, 'children'])).toBe(1);
  r.add(['people', 0, 'children', 1, 'value']);
  r.type(['people', 0, 'children', 1, 'value', 1], 'new');
  expect(r.values(['people', 0, 'children', 1, 'value'])).toEqual(['retained', 'new']);
  expect(r.error).not.toHaveBeenCalled();
});
