import { ChildSpec, FieldSpec, Reader, Step, templateJson } from './carried-answers.testing';
import { InstanceSerializer } from './instance-serializer';

// Every combination of single/repeating ancestors, from the root through depth 3.
const structures = Array.from({ length: 4 }, (_, depth) =>
  Array.from({ length: 2 ** depth }, (_, mask) => ({ depth, mask })),
).flat();
const operations = ['add', 'copy', 'delete', 'clear', 'answer', 'mixed'] as const;

function shape(
  field: FieldSpec,
  depth: number,
  mask: number,
  renamed = false,
): { children: ChildSpec[]; place: Step[] } {
  let child: ChildSpec = { ...field, key: renamed ? 'renamed' : 'value', iri: 'https://example.org/value' };
  let place: Step[] = [child.key];
  for (let level = depth - 1; level >= 0; level--) {
    const multi = (mask & (1 << level)) !== 0;
    const key = `${renamed ? 'renamed-' : ''}level${level}`;
    child = { key, iri: `https://example.org/level${level}`, multi, min: multi ? 1 : null, element: [child] };
    place = [key, ...(multi ? [0] : []), ...place];
  }
  return { children: [child], place };
}

interface ExpectedEntry {
  defaulted: boolean;
  padded: boolean;
  value: string | null;
}
const fresh = (padded = false): ExpectedEntry => ({ defaulted: true, padded, value: padded ? null : 'base' });
const json = (reader: Reader) => InstanceSerializer.toJson(reader.coordinator.state.dataContext.instanceFullData);

describe('preview editing history matrix', () => {
  it.each(structures.flatMap((structure) => operations.map((operation) => ({ ...structure, operation }))))(
    'depth $depth, repeating mask $mask, $operation, across successive edits',
    ({ depth, mask, operation }) => {
      const field: FieldSpec = { kind: 'text', key: 'value', multi: true, min: 2, default: 'base' };
      const initial = shape(field, depth, mask);
      const r = new Reader().open(templateJson(initial.children));
      const expected = [fresh(), fresh(true)];
      const add = () => {
        r.turn(initial.place, 0).add(initial.place);
        expected.splice(1, 0, fresh());
      };
      const copy = () => {
        r.turn(initial.place, 0).copy(initial.place);
        expected.splice(1, 0, { ...expected[0] });
      };
      const remove = () => {
        r.turn(initial.place, 0).remove(initial.place);
        expected.splice(0, 1);
      };
      const write = (index: number, value: string | null) => {
        r.type([...initial.place, index], value);
        expected[index] = { defaulted: false, padded: false, value };
      };
      if (operation === 'add') add();
      if (operation === 'copy') copy();
      if (operation === 'delete') {
        add();
        remove();
      }
      if (operation === 'clear') write(0, null);
      if (operation === 'answer') write(1, 'reader');
      if (operation === 'mixed') {
        write(0, 'reader');
        copy();
        add();
        remove();
        write(0, null);
      }
      const snapshot = json(r);
      r.open(templateJson(initial.children));
      expect(json(r)).toEqual(snapshot);
      for (const [index, defaultValue] of ['reader', 'next', 'final'].entries()) {
        const next = shape({ ...field, default: defaultValue }, depth, mask, index !== 1);
        r.open(templateJson(next.children));
        expect(r.values(next.place)).toEqual(
          expected.map((entry) => (entry.defaulted ? (entry.padded ? null : defaultValue) : entry.value)),
        );
        expect(r.errors()).toEqual([]);
        expect(r.trace).not.toHaveBeenCalled();
      }
    },
  );

  it.each(structures)('preserves independent copied nested branches at depth $depth mask $mask', ({ depth, mask }) => {
    const nested = shape({ kind: 'text', key: 'value', multi: true }, depth, mask);
    const children: ChildSpec[] = [{ key: 'people', multi: true, element: nested.children }];
    const r = new Reader().open(templateJson(children)).add(['people']);
    const first = ['people', 0, ...nested.place];
    if (r.count(first) === 0) r.add(first);
    r.type([...first, 0], 'original').copy(['people']);
    const second = ['people', 1, ...nested.place];
    r.type([...second, 0], 'copy');
    r.open(templateJson(children, { description: 'edit' }));
    expect(r.value([...first, 0])).toBe('original');
    expect(r.value([...second, 0])).toBe('copy');
    r.type([...second, 0], 'later');
    expect(r.value([...first, 0])).toBe('original');
  });
});

const temporal = [
  { temporalType: 'xsd:date', granularity: 'year', value: '2026-01-01', parts: ['year'] },
  { temporalType: 'xsd:date', granularity: 'month', value: '2026-10-01', parts: ['year', 'month'] },
  { temporalType: 'xsd:date', granularity: 'day', value: '2026-10-09', parts: ['year', 'month', 'day'] },
  { temporalType: 'xsd:dateTime', granularity: 'day', value: '2026-10-09T00:00:00', parts: ['year', 'month', 'day'] },
  {
    temporalType: 'xsd:dateTime',
    granularity: 'minute',
    value: '2026-10-09T12:34:00',
    parts: ['year', 'month', 'day', 'hour', 'minute'],
  },
  { temporalType: 'xsd:time', granularity: 'hour', value: '12:00:00', parts: ['hour'] },
  { temporalType: 'xsd:time', granularity: 'minute', value: '12:34:00', parts: ['hour', 'minute'] },
  { temporalType: 'xsd:time', granularity: 'second', value: '12:34:56', parts: ['hour', 'minute', 'second'] },
  {
    temporalType: 'xsd:time',
    granularity: 'decimalSecond',
    value: '12:34:56.001',
    parts: ['hour', 'minute', 'second', 'fraction'],
  },
] as const;

describe('temporal semantic conversion matrix', () => {
  it.each(temporal.flatMap((from) => temporal.map((to) => ({ from, to }))))(
    '$from.temporalType/$from.granularity to $to.temporalType/$to.granularity',
    ({ from, to }) => {
      const field = (spec: typeof from): FieldSpec => ({
        kind: 'temporal',
        key: 'value',
        temporalType: spec.temporalType,
        granularity: spec.granularity,
      });
      const r = new Reader().open(templateJson([field(from)])).type(['value'], from.value);
      expect(r.errors()).toEqual([]);
      r.open(templateJson([field(to)]));
      const possible = to.parts.every((part) => (from.parts as readonly string[]).includes(part));
      if (possible) expect(r.value(['value'])).toBe(to.value);
      else expect(r.value(['value'])).toBeNull();
      expect(r.errors()).toEqual([]);
      expect(r.trace).not.toHaveBeenCalled();
    },
  );
});

describe('draft lineage matrix', () => {
  it.each(structures)('copy, delete, rename and complete at depth $depth mask $mask', ({ depth, mask }) => {
    const field: FieldSpec = {
      kind: 'temporal',
      key: 'value',
      multi: true,
      min: 1,
      temporalType: 'xsd:dateTime',
      granularity: 'minute',
    };
    const initial = shape(field, depth, mask);
    const r = new Reader().open(templateJson(initial.children));
    const draft = {
      code: 'incompleteValue',
      message: 'Complete or clear the date/time value.',
      value: null,
      state: { dateIsSet: true, timeIsSet: false, timezoneIsSet: false, year: '2026', month: '10', day: '09' },
    };
    r.typeDraft([...initial.place, 0], draft).copy(initial.place);
    expect(r.draft([...initial.place, 1])).toEqual(draft);
    r.turn(initial.place, 0).remove(initial.place);
    const next = shape(field, depth, mask, true);
    r.open(templateJson(next.children));
    expect(r.draft([...next.place, 0])).toEqual(draft);
    expect(r.errors()).toHaveLength(1);
    r.type([...next.place, 0], '2026-10-09T12:34:00');
    r.open(templateJson(next.children, { description: 'completed' }));
    expect(r.draft([...next.place, 0])).toBeNull();
    expect(r.value([...next.place, 0])).toBe('2026-10-09T12:34:00');
    expect(r.errors()).toEqual([]);
    expect(r.trace).not.toHaveBeenCalled();
  });
});

describe('recovery isolation matrix', () => {
  it.each(structures.flatMap((structure) => ['value', 'configuration'].map((defect) => ({ ...structure, defect }))))(
    'depth $depth mask $mask, $defect defect, multiple affected entries',
    ({ depth, mask, defect }) => {
      const nested = (bad: boolean) =>
        shape(
          {
            kind: 'text',
            key: 'value',
            maxLength: 4,
            ...(bad ? (defect === 'value' ? { default: 'too long' } : { regex: '[' }) : {}),
          },
          depth,
          mask,
        );
      const schema = (bad: boolean): ChildSpec[] => [
        { kind: 'text', key: 'safe' },
        { key: 'optional', multi: true, element: nested(bad).children },
      ];
      const r = new Reader()
        .open(templateJson(schema(false)))
        .type(['safe'], 'unrelated')
        .add(['optional'], 3);
      r.open(templateJson(schema(true)));
      expect(r.value(['safe'])).toBe('unrelated');
      expect(r.errors()).toEqual([]);
      expect(r.count(['optional'])).toBe(defect === 'configuration' ? 0 : 3);
      expect(r.trace).not.toHaveBeenCalled();
    },
  );
});

it('restores the nearest earlier pager entry when local recovery removes the selected entry', () => {
  const schema = (bad: boolean): ChildSpec[] => [
    {
      key: 'people',
      multi: true,
      element: [{ kind: 'text', key: 'values', multi: true, maxLength: 4, ...(bad ? { default: 'invalid' } : {}) }],
    },
  ];
  const r = new Reader()
    .open(templateJson(schema(false)))
    .add(['people'])
    .add(['people', 0, 'values'], 3)
    .type(['people', 0, 'values', 0], 'a')
    .type(['people', 0, 'values', 2], 'c')
    .turn(['people', 0, 'values'], 1);
  r.open(templateJson(schema(true)));
  expect(r.values(['people', 0, 'values'])).toEqual(['a', 'c']);
  expect(r.cursor(['people', 0, 'values'])).toBe(0);
  expect(r.trace).not.toHaveBeenCalled();
});

it.each(structures.flatMap((structure) => [0, 2].map((min) => ({ ...structure, min }))))(
  'retains existing invalid pristine defaults at depth $depth mask $mask min $min',
  ({ depth, mask, min }) => {
    const schema = (renamed: boolean, defaultValue: string): ChildSpec[] => [
      {
        key: 'people',
        multi: true,
        element: shape(
          { kind: 'text', key: 'value', multi: true, min, maxLength: 3, default: defaultValue },
          depth,
          mask,
          renamed,
        ).children,
      },
    ];
    const r = new Reader().open(templateJson(schema(false, 'invalid'))).add(['people'], 2);
    const before = json(r);
    const errors = r.errors().length;
    expect(errors).toBe(2);
    r.open(templateJson(schema(false, 'invalid')));
    expect(json(r)).toEqual(before);
    r.open(templateJson(schema(true, 'invalid')));
    expect(r.errors()).toHaveLength(errors);
    r.open(templateJson(schema(true, 'new')));
    expect(r.errors()).toEqual([]);
    const place = ['people', 0, ...shape({ kind: 'text', key: 'value' }, depth, mask, true).place];
    expect(r.values(place)[0]).toBe('new');
    expect(r.trace).not.toHaveBeenCalled();
  },
);
