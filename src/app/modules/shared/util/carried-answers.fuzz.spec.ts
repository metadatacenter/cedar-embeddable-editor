/**
 * The carrying's promises, checked against templates and edits nobody chose.
 *
 * Each run builds a random template, has a reader fill it in with values both valid
 * and not, makes a random edit an author could make in the designer, and replaces
 * the reader's form with the edited template. Three things must hold every time:
 *
 * - the new form shows no error that a fresh form of the edited template, or the
 *   reader's own entries, did not already have;
 * - a field the edit did not touch comes through exactly as the reader left it;
 * - replacing the form with the template it already has changes nothing.
 *
 * The generator is seeded, so a failure names the run that reproduces it.
 */
import { InstanceSerializer } from './instance-serializer';
import { ChildSpec, ElementSpec, FieldKind, FieldSpec, Reader, templateJson } from './carried-answers.testing';

/** More with `CARRY_FUZZ_RUNS`, when hunting for a rare failure; one with `CARRY_FUZZ_RUN`, to see it. */
const RUNS = Number(process.env['CARRY_FUZZ_RUNS'] ?? 400);
const ONLY = process.env['CARRY_FUZZ_RUN'];

/** mulberry32: small, fast and the same everywhere. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;
const pick = <T>(rng: Random, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const chance = (rng: Random, p: number): boolean => rng() < p;
const between = (rng: Random, low: number, high: number): number => low + Math.floor(rng() * (high - low + 1));

const KINDS: readonly FieldKind[] = [
  'text',
  'textarea',
  'email',
  'phone',
  'numeric',
  'temporal',
  'radio',
  'checkbox',
  'list',
  'multiList',
  'link',
];
const REPEATABLE: ReadonlySet<FieldKind> = new Set([
  'text',
  'textarea',
  'email',
  'phone',
  'numeric',
  'temporal',
  'link',
]);
const CHOICE: ReadonlySet<FieldKind> = new Set(['radio', 'checkbox', 'list', 'multiList']);
const OPTIONS = ['Alpha', 'Beta', 'Gamma', 'Delta'];
const TEMPORAL: ReadonlyArray<Pick<FieldSpec, 'temporalType' | 'granularity'>> = [
  { temporalType: 'xsd:date', granularity: 'year' },
  { temporalType: 'xsd:date', granularity: 'month' },
  { temporalType: 'xsd:date', granularity: 'day' },
  { temporalType: 'xsd:dateTime', granularity: 'day' },
  { temporalType: 'xsd:dateTime', granularity: 'minute' },
  { temporalType: 'xsd:time', granularity: 'minute' },
  { temporalType: 'xsd:time', granularity: 'hour' },
];
const TYPED: Record<string, readonly string[]> = {
  text: ['hello', 'ABC', 'ab', '4', '4.5', '2026-10-09', 'a@example.org', '+1 650 555 0100', 'Beta', 'call me'],
  numeric: ['4', '4.5', '-3', '1.25', '1000', 'abc'],
  temporal: ['2026-10-09', '2026-01-01', '2026-10-09T10:30:00', '10:30:00', 'tomorrow'],
  link: ['https://example.org/a', 'https://example.org/b', 'not an iri'],
};

let keys = 0;
const newKey = (): string => `k${keys++}`;

function field(rng: Random, kind: FieldKind = pick(rng, KINDS), key = newKey()): FieldSpec {
  const spec: { -readonly [K in keyof FieldSpec]: FieldSpec[K] } = { kind, key };
  if (REPEATABLE.has(kind) && chance(rng, 0.4)) {
    spec.multi = true;
    spec.min = chance(rng, 0.3) ? between(rng, 0, 2) : null;
    spec.max = chance(rng, 0.4) ? between(rng, Math.max(spec.min ?? 0, 1), 3) : null;
  }
  if (kind === 'checkbox' || kind === 'multiList') {
    spec.max = chance(rng, 0.3) ? between(rng, 1, 3) : null;
  }
  if (CHOICE.has(kind)) {
    spec.options = OPTIONS.filter(() => chance(rng, 0.7));
    if (spec.options.length === 0) spec.options = ['Alpha'];
    if (chance(rng, 0.3)) spec.selected = [pick(rng, spec.options)];
  }
  if (kind === 'text' && chance(rng, 0.3)) spec.maxLength = between(rng, 2, 8);
  if (kind === 'text' && chance(rng, 0.15)) spec.regex = '[A-Z]+';
  if (kind === 'numeric') {
    spec.numberType = pick(rng, ['xsd:decimal', 'xsd:int', 'xsd:double']);
    if (chance(rng, 0.3)) spec.maxValue = between(rng, 0, 100);
    if (chance(rng, 0.2) && spec.numberType === 'xsd:decimal') spec.decimals = between(rng, 0, 2);
  }
  if (kind === 'temporal') Object.assign(spec, pick(rng, TEMPORAL));
  if (chance(rng, 0.2)) {
    if (kind === 'text' || kind === 'textarea') spec.default = pick(rng, ['Draft', 'X']);
    if (kind === 'numeric' && (spec.maxValue === undefined || spec.maxValue >= 1)) spec.default = 1;
  }
  if (chance(rng, 0.2)) spec.required = true;
  return spec;
}

function template(rng: Random): ChildSpec[] {
  const children: ChildSpec[] = Array.from({ length: between(rng, 1, 4) }, () => field(rng));
  if (chance(rng, 0.5)) {
    const multi = chance(rng, 0.6);
    children.push({
      key: newKey(),
      element: Array.from({ length: between(rng, 1, 3) }, () => field(rng)),
      multi,
      max: multi && chance(rng, 0.3) ? between(rng, 1, 3) : null,
    });
  }
  return children;
}

const isElement = (child: ChildSpec): child is ElementSpec => 'element' in child;

/** Fill in everything the form holds, some of it badly. */
function fill(rng: Random, reader: Reader, children: readonly ChildSpec[], prefix: Array<string | number> = []): void {
  for (const child of children) {
    const place = [...prefix, child.key];
    if (isElement(child)) {
      if (child.multi) {
        const adds = between(rng, 0, 2);
        for (let i = 0; i < adds; i++) attempt(() => reader.add(place));
        const count = reader.count(place) ?? 0;
        for (let entry = 0; entry < count; entry++) fill(rng, reader, child.element, [...place, entry]);
      } else {
        fill(rng, reader, child.element, place);
      }
      continue;
    }
    if (chance(rng, 0.25)) continue;
    if (child.kind === 'checkbox' || child.kind === 'multiList') {
      attempt(() =>
        reader.choose(
          place,
          (child.options ?? []).filter(() => chance(rng, 0.5)),
        ),
      );
    } else if (child.kind === 'radio' || child.kind === 'list') {
      attempt(() => reader.type(place, pick(rng, [...(child.options ?? []), 'Zeta'])));
    } else if (child.multi) {
      const adds = between(rng, 0, 3);
      for (let i = 0; i < adds; i++) attempt(() => reader.add(place));
      const count = reader.count(place) ?? 0;
      for (let entry = 0; entry < count; entry++) {
        if (chance(rng, 0.7)) attempt(() => reader.type([...place, entry], pick(rng, typed(child.kind))));
      }
    } else {
      attempt(() => reader.type(place, pick(rng, typed(child.kind))));
    }
  }
}

const typed = (kind: FieldKind): readonly string[] => TYPED[kind] ?? TYPED['text'];

/** A reader can try what the form refuses, such as adding past a maximum. */
function attempt(action: () => unknown): void {
  try {
    action();
  } catch {
    // The form refused, as it would refuse a person.
  }
}

/** One edit an author could make, and the keys of the children it touched. */
function edit(rng: Random, children: readonly ChildSpec[]): { children: ChildSpec[]; touched: Set<string> } {
  const next = structuredClone(children) as ChildSpec[];
  const touched = new Set<string>();
  const index = Math.floor(rng() * next.length);
  const target = next[index];
  const change = pick(rng, [
    'kind',
    'bounds',
    'single',
    'options',
    'constraint',
    'default',
    'remove',
    'add',
    'rename',
    'reorder',
    'element',
    'nested',
  ]);
  const touch = (key: string) => touched.add(key);
  if (change === 'reorder') {
    next.reverse();
  } else if (change === 'add') {
    next.push(field(rng));
  } else if (change === 'remove') {
    touch(target.key);
    next.splice(index, 1);
  } else if (change === 'rename') {
    touch(target.key);
    next[index] = { ...target, key: newKey(), iri: `https://schema.metadatacenter.org/properties/${target.key}` };
  } else if (isElement(target)) {
    touch(target.key);
    if (change === 'element' || change === 'bounds' || change === 'single') {
      const multi = !target.multi || chance(rng, 0.5);
      next[index] = { ...target, multi, max: multi && chance(rng, 0.6) ? between(rng, 1, 2) : null };
    } else {
      const nested = edit(rng, target.element);
      next[index] = { ...target, element: nested.children };
    }
  } else {
    touch(target.key);
    const spec: { -readonly [K in keyof FieldSpec]: FieldSpec[K] } = { ...target };
    if (change === 'kind') {
      next[index] = { ...field(rng, pick(rng, KINDS), target.key) };
    } else if (change === 'bounds' && REPEATABLE.has(spec.kind)) {
      spec.multi = true;
      spec.min = chance(rng, 0.5) ? between(rng, 0, 2) : null;
      spec.max = between(rng, Math.max(spec.min ?? 0, 1), 2);
      next[index] = spec;
    } else if (change === 'single') {
      spec.multi = false;
      spec.min = null;
      spec.max = null;
      next[index] = spec;
    } else if (change === 'options' && spec.options !== undefined) {
      spec.options = spec.options.map((option) => (chance(rng, 0.4) ? `${option}2` : option));
      spec.selected = undefined;
      next[index] = spec;
    } else if (change === 'constraint') {
      if (spec.kind === 'numeric') spec.maxValue = between(rng, spec.default === undefined ? 0 : 1, 5);
      else if (spec.kind === 'text') spec.maxLength = between(rng, 1, 3);
      else if (spec.kind === 'temporal') Object.assign(spec, pick(rng, TEMPORAL));
      next[index] = spec;
    } else {
      if (spec.kind === 'text' || spec.kind === 'textarea') spec.default = pick(rng, ['Final', 'Y']);
      next[index] = spec;
    }
  }
  return { children: next, touched };
}

const written = (reader: Reader): Record<string, unknown> =>
  InstanceSerializer.toJson(reader.coordinator.state.dataContext.instanceFullData) as Record<string, unknown>;

/** Independent oracle: renames preserve property identity, and one error cannot
 * authorize arbitrarily many occurrences or a different offending value. */
function errorCounts(reader: Reader, children: readonly ChildSpec[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const problem of reader.coordinator.state.dataContext.dataQualityReport?.problems ?? []) {
    if (problem.severity !== 'error') continue;
    let siblings = children;
    const identity = problem.path.map((name) => {
      const child = siblings.find((candidate) => candidate.key === name);
      if (!child) throw new Error(`Unknown report path ${problem.path.join('/')}`);
      siblings = isElement(child) ? child.element : [];
      return child.iri ?? `https://schema.metadatacenter.org/properties/${encodeURIComponent(child.key)}`;
    });
    const key = JSON.stringify([identity, problem.code, problem.value]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

describe('carrying answers through edits nobody chose', () => {
  const runs = ONLY === undefined ? Array.from({ length: RUNS }, (_, run) => run) : [Number(ONLY)];
  it.each(runs)('run %i', (run) => {
    const rng = random(run + 1);
    keys = 0;
    const children = template(rng);
    const reader = new Reader().open(templateJson(children));
    fill(rng, reader, children);
    const own = errorCounts(reader, children);

    // The same template again changes nothing.
    const before = written(reader);
    reader.open(templateJson(children));
    expect(written(reader)).toEqual(before);

    // An edit brings no error with it, and leaves what it did not touch alone.
    const edited = edit(rng, children);
    const target = templateJson(edited.children);
    const fresh = errorCounts(new Reader().open(target), edited.children);
    reader.open(target);
    if (ONLY !== undefined) {
      console.log(
        JSON.stringify({ children, edited: edited.children, before, own: [...own], fresh: [...fresh] }, null, 1),
      );
      console.log(
        JSON.stringify({ after: written(reader), errors: reader.errors(), trace: reader.trace.mock.calls }, null, 1),
      );
    }
    for (const [error, count] of errorCounts(reader, edited.children)) {
      expect(count, error).toBeLessThanOrEqual((own.get(error) ?? 0) + (fresh.get(error) ?? 0));
    }
    expect(reader.trace).not.toHaveBeenCalledWith(expect.stringContaining('answers not carried'));
    expect(reader.error).not.toHaveBeenCalled();

    const after = written(reader);
    const untouched = edited.children.filter(
      (child) => !edited.touched.has(child.key) && children.some((previous) => previous.key === child.key),
    );
    for (const child of untouched) {
      expect(after[child.key], `${child.key} in run ${run}`).toEqual(before[child.key]);
    }
  });
});
