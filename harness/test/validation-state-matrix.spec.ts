import { NumberType } from 'cedar-model-typescript-library';
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS, FieldKind } from '../src/axes';
import { buildTemplate, ChildSpec, ElementSpec } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { ValidationProblem } from '@cee/validation/validation-problem.model';

const kind = (key: string): FieldKind => FIELD_KINDS.find((entry) => entry.key === key)!;
const depths = [0, 1, 3, 6];
const modes = [false, true];

/** Each repeated ancestor has an empty sibling and the branch under test at index 1. */
function nested(spec: ChildSpec, value: unknown, depth: number, elementCardinality: 'single' | 'multi' = 'multi') {
  let elements: ElementSpec[] = [];
  let children = [spec];
  let values: Record<string, unknown> = { _f: value };
  const path = ['_f'];
  const occurrences: number[] = [];
  for (let level = depth - 1; level >= 0; level--) {
    const name = `level${level}`;
    elements = [{ name, cardinality: elementCardinality, minItems: 0, children, elements }];
    children = [];
    values = { [`_${name}`]: elementCardinality === 'multi' ? [{}, values] : values };
    path.unshift(`_${name}`);
    if (elementCardinality === 'multi') occurrences.unshift(1);
  }
  const template = buildTemplate({ name: 'state_matrix', children, elements });
  const instance = { '@context': {}, 'schema:isBasedOn': (template as Record<string, unknown>)['@id'], ...values };
  return { template, instance, path, occurrences };
}

const badValues = [
  {
    name: 'label without an IRI',
    kind: 'controlled',
    value: { 'rdfs:label': 'orphan' },
    code: 'valueShape',
    repair: 'Term',
  },
  {
    name: 'literal in a controlled field',
    kind: 'controlled',
    value: { '@value': 'term' },
    code: 'valueShape',
    repair: 'Term',
  },
  {
    name: 'IRI in a literal field',
    kind: 'text',
    value: { '@id': 'https://example.org/value' },
    code: 'valueShape',
    repair: 'fixed',
  },
  {
    name: 'container in a literal field',
    kind: 'text',
    value: { _nested: { '@value': 'hidden' } },
    code: 'valueShape',
    repair: 'fixed',
  },
  { name: 'email', kind: 'email', value: { '@value': 'not-an-email' }, code: 'email', repair: 'a@example.org' },
  {
    name: 'phone with a valid first line',
    kind: 'phone',
    value: { '@value': '12345\nnot a phone' },
    code: 'phoneNumber',
    repair: '+1 555 0100',
  },
];

describe.each(depths)('invalid incoming values at depth %i', (depth) => {
  describe.each(modes)('readOnly=%s', (readOnlyMode) => {
    it.each(badValues)('$name survives navigation and can be repaired', (test) => {
      const fieldKind = kind(test.kind);
      const fixture = nested({ kind: fieldKind, name: 'f' }, test.value, depth);
      const supplied = JSON.stringify(fixture.instance);
      const driver = new CeeDriver(fixture.template, { instance: fixture.instance, readOnlyMode });
      const problem = () => driver.qualityReport.problems.find((p: ValidationProblem) => p.code === test.code);
      expect(problem()).toMatchObject({ path: fixture.path, occurrences: fixture.occurrences, severity: 'error' });
      expect(driver.qualityReport.isValid).toBe(false);
      const initial = driver.qualityReport;
      for (let level = 0; level < depth; level++) {
        const parent = driver.findOrThrow(fixture.path.slice(0, level + 1));
        driver.handlerContext.setCurrentIndex(parent, 0);
        driver.handlerContext.buildQualityReport();
        expect(driver.qualityReport).toEqual(initial);
        driver.handlerContext.setCurrentIndex(parent, 1);
      }
      // Host input is immutable even when the reader cannot make a value from it.
      expect(JSON.stringify(fixture.instance)).toBe(supplied);
      if (readOnlyMode) {
        driver.setValue(fixture.path, fieldKind, test.repair);
        expect(driver.qualityReport).toEqual(initial);
        driver.handlerContext.readOnlyMode = false;
      }
      driver.setValue(fixture.path, fieldKind, test.repair);
      expect(driver.qualityReport.isValid, JSON.stringify([driver.qualityReport, driver.messages.errors])).toBe(true);
      expect(driver.qualityReport.problems).toEqual([]);
      const reloaded = new CeeDriver(fixture.template, { instance: driver.emitted, readOnlyMode });
      expect(reloaded.qualityReport.isValid).toBe(true);
    });
  });
});

describe.each([1, 3, 6])('required values in every containing occurrence at depth %i', (depth) => {
  it('cannot use a filled sibling to conceal an empty occurrence', () => {
    const fixture = nested({ kind: kind('text'), name: 'f', required: true }, { '@value': 'filled' }, depth);
    const driver = new CeeDriver(fixture.template, { instance: fixture.instance });
    expect(driver.qualityReport.isValid).toBe(false);
    expect(driver.qualityReport.problems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'required',
          severity: 'warning',
          occurrences: [...fixture.occurrences.slice(0, -1), 0],
        }),
      ]),
    );
    // The counters remain declaration counts; a declaration is complete only in every existing parent.
    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
    for (let level = 0; level < depth - 1; level++) {
      driver.handlerContext.setCurrentIndex(driver.findOrThrow(fixture.path.slice(0, level + 1)), 1);
    }
    const parent = driver.findOrThrow(fixture.path.slice(0, -1));
    driver.handlerContext.setCurrentIndex(parent, 0);
    driver.setValue(fixture.path, kind('text'), 'repaired');
    expect(driver.qualityReport.isValid, JSON.stringify([driver.qualityReport, driver.messages.errors])).toBe(true);
  });
});

const numericKind = (numberType: NumberType): FieldKind => ({
  ...kind('numeric'),
  configure: (builder) => builder.withNumberType(numberType).withMinValue(10).withMaxValue(100),
});
const numericCases = [
  { value: '9', code: 'minValue' },
  { value: '10', code: null },
  { value: '50', code: null },
  { value: '100', code: null },
  { value: '101', code: 'maxValue' },
  { value: '1000', code: 'maxValue' },
  { value: 'NaN', code: 'numberType' },
  { value: 'Infinity', code: 'numberType' },
];
for (const numberType of [
  NumberType.BYTE,
  NumberType.SHORT,
  NumberType.INT,
  NumberType.LONG,
  NumberType.FLOAT,
  NumberType.DOUBLE,
  NumberType.DECIMAL,
]) {
  describe.each(depths)(`${numberType} bounds and live changes at depth %i`, (depth) => {
    it.each(numericCases)('$value → repair → invalid → clear → reload', ({ value, code }) => {
      const fieldKind = numericKind(numberType);
      const fixture = nested({ kind: fieldKind, name: 'f' }, { '@value': value }, depth);
      const driver = new CeeDriver(fixture.template, { instance: fixture.instance });
      expect(driver.qualityReport.isValid).toBe(code === null);
      if (code)
        expect(driver.qualityReport.problems).toContainEqual(
          expect.objectContaining({ code, occurrences: fixture.occurrences }),
        );
      fixture.path
        .slice(0, -1)
        .forEach((_step, index) =>
          driver.handlerContext.setCurrentIndex(driver.findOrThrow(fixture.path.slice(0, index + 1)), 1),
        );
      const events: boolean[] = [];
      driver.handlerContext.setMutationListener(() => events.push(driver.qualityReport.isValid));
      driver.setValue(fixture.path, fieldKind, '50');
      expect(driver.qualityReport.problems).toEqual([]);
      driver.setValue(fixture.path, fieldKind, '1000');
      expect(driver.qualityReport.problems).toContainEqual(
        expect.objectContaining({ code: 'maxValue', value: '1000' }),
      );
      driver.handlerContext.changeValue(driver.findOrThrow(fixture.path), null);
      expect(events).toEqual([true, false, true]);
      expect(new CeeDriver(fixture.template, { instance: driver.emitted }).qualityReport.isValid).toBe(true);
    });
  });
}

const identifiers = [
  ['https://example.org/id', true],
  ['https://例え.jp/用語', true],
  ['urn:example:term', true],
  ['doi:10.123/example', true],
  ['not-an-iri', false],
  ['https://', false],
  ['https:example.org/id', false],
  ['https://example.org/%GG', false],
  ['https://example.org/a b', false],
  ['https://example.org/a\\b', false],
  ['https://example.org/\u0001', false],
  ['https://example.org/\uD800', false],
] as const;
describe.each(depths)('incoming identifiers at depth %i', (depth) => {
  describe.each(['orcid', 'controlled'])('%s', (key) => {
    it('preserves the authority scheme policy independently of general IRI syntax', () => {
      const iri = 'orcid:0000-0002-1825-0097';
      const value = key === 'controlled' ? { '@id': iri, 'rdfs:label': 'Term' } : { '@id': iri };
      const fixture = nested({ kind: kind(key), name: 'f' }, value, depth);
      const driver = new CeeDriver(fixture.template, { instance: fixture.instance });
      expect(driver.qualityReport.isValid).toBe(key === 'controlled');
    });
    it.each(identifiers)('%s valid=%s; correction is immediate', (iri, valid) => {
      const fieldKind = kind(key);
      const value = key === 'controlled' ? { '@id': iri, 'rdfs:label': 'Term' } : { '@id': iri };
      const fixture = nested({ kind: fieldKind, name: 'f' }, value, depth);
      const driver = new CeeDriver(fixture.template, { instance: fixture.instance });
      expect(driver.qualityReport.isValid).toBe(valid);
      if (!valid)
        expect(driver.qualityReport.problems).toContainEqual(
          expect.objectContaining({ code: 'iriMalformed', occurrences: fixture.occurrences }),
        );
      fixture.path
        .slice(0, -1)
        .forEach((_step, index) =>
          driver.handlerContext.setCurrentIndex(driver.findOrThrow(fixture.path.slice(0, index + 1)), 1),
        );
      driver.setValue(fixture.path, fieldKind);
      expect(driver.qualityReport.isValid).toBe(true);
      expect(new CeeDriver(fixture.template, { instance: driver.emitted }).qualityReport.isValid).toBe(true);
    });
  });
});

it('reports a template/instance mismatch rather than announcing a valid form', () => {
  const template = buildTemplate({ name: 'mismatch', children: [{ kind: kind('text'), name: 'f' }] });
  const driver = new CeeDriver(template, {
    instance: { '@context': {}, 'schema:isBasedOn': 'https://example.org/other', _f: { '@value': 'ok' } },
  });
  expect(driver.qualityReport.problems).toContainEqual(
    expect.objectContaining({ code: 'templateMismatch', path: [], severity: 'error' }),
  );
  driver.setValue(['_f'], kind('text'), 'still wrong template');
  expect(driver.qualityReport.isValid).toBe(false);
});

it('retains and reports an out-of-range declared default', () => {
  const template = buildTemplate({
    name: 'default',
    children: [{ kind: numericKind(NumberType.INT), name: 'f', defaultValue: 50 }],
  }) as any;
  template.properties._f._valueConstraints.defaultValue = 1000;
  const driver = new CeeDriver(template);
  expect(driver.qualityReport.problems).toContainEqual(expect.objectContaining({ code: 'maxValue', value: '1000' }));
  driver.setValue(['_f'], kind('numeric'), '50');
  expect(driver.qualityReport.isValid).toBe(true);
});

it.each(['', ' ', '@id', '_other', 'existing', 'bad\nname'])(
  'rejected attribute name %j cannot redirect deletion',
  (rejected) => {
    const template = buildTemplate({
      name: 'attributes',
      children: [
        { kind: kind('attrValue'), name: 'f', cardinality: 'multi', minItems: 0, maxItems: 5 },
        { kind: kind('text'), name: 'other' },
      ],
    });
    const driver = new CeeDriver(template);
    const field = driver.findOrThrow(['_f']);
    const context = driver.handlerContext;
    context.addMultiInstance(field);
    context.changeAttributeValue(field, 'existing', 'keep');
    context.addMultiInstance(field);
    context.changeAttributeValue(field, 'remove', 'remove');
    context.changeAttributeValue(field, rejected, 'unfinished');
    const reports: unknown[] = [];
    context.setMutationListener(() => reports.push(driver.emitted));
    context.deleteMultiInstance(field);
    expect(driver.emitted.existing).toMatchObject({ '@value': 'keep' });
    expect(driver.emitted.remove).toBeUndefined();
    expect(driver.qualityReport.problems.filter((p: ValidationProblem) => p.severity === 'error')).toEqual([]);
    expect(reports).toEqual([driver.emitted]);
  },
);

const defaults = [
  { key: 'numeric', original: 50, incoming: 1000, code: 'maxValue' },
  { key: 'numeric', original: 50, incoming: '1000', code: 'maxValue' },
  { key: 'temporal', original: '2026-10-03', incoming: '2026-02-31', code: 'temporalCalendar' },
  { key: 'temporal', original: '2026-10-03', incoming: 'not a date', code: 'temporalType' },
  { key: 'link', original: 'https://example.org/good', incoming: 'https://bad iri', code: 'link' },
  { key: 'orcid', original: 'https://example.org/good', incoming: 'https://bad iri', code: 'iriMalformed' },
  {
    key: 'controlled',
    original: { iri: 'https://example.org/good', label: 'Good' },
    incoming: { termUri: 'https://bad iri', 'rdfs:label': 'Bad' },
    code: 'iriMalformed',
  },
];
describe.each(depths)('invalid defaults at depth %i', (depth) => {
  describe.each(modes)('readOnly=%s', (readOnlyMode) => {
    it.each(defaults)('$key $incoming is reported before its widget mounts', ({ key, original, incoming, code }) => {
      const fieldKind = key === 'numeric' ? numericKind(NumberType.INT) : kind(key);
      const fixture = nested(
        { kind: fieldKind, name: 'f', defaultValue: key === 'link' || key === 'orcid' ? undefined : original },
        null,
        depth,
      );
      let schema = fixture.template as any;
      for (const segment of fixture.path.slice(0, -1)) {
        schema.properties[segment].minItems = 1;
        schema = schema.properties[segment].items;
      }
      schema.properties._f._valueConstraints.defaultValue = incoming;
      const originalJson = JSON.stringify(fixture.template);
      const driver = new CeeDriver(fixture.template, { readOnlyMode });
      expect(driver.qualityReport.problems).toContainEqual(
        expect.objectContaining({ code, path: fixture.path, occurrences: Array(depth).fill(0) }),
      );
      expect(driver.qualityReport.isValid).toBe(false);
      expect(JSON.stringify(fixture.template)).toBe(originalJson);
      if (readOnlyMode) {
        const before = driver.qualityReport;
        driver.setValue(fixture.path, fieldKind, key === 'numeric' ? '50' : fieldKind.sample);
        expect(driver.qualityReport).toEqual(before);
        driver.handlerContext.readOnlyMode = false;
      }
      driver.setValue(fixture.path, fieldKind, key === 'numeric' ? '50' : fieldKind.sample);
      expect(driver.qualityReport.isValid, JSON.stringify(driver.qualityReport)).toBe(true);
      expect(new CeeDriver(fixture.template, { instance: driver.emitted, readOnlyMode }).qualityReport.isValid).toBe(
        true,
      );
    });
  });
});

it('cannot create an invisible value at index -1 of an empty repeating field', () => {
  const driver = new CeeDriver(
    buildTemplate({
      name: 'empty_list',
      children: [{ kind: kind('text'), name: 'f', cardinality: 'multi', minItems: 0 }],
    }),
  );
  driver.setValue(['_f'], kind('text'), 'no occurrence owns this');
  const list = driver.handlerContext.getDataObjectNodeByPath(['_f']);
  expect(Array.isArray(list)).toBe(true);
  expect(Object.keys(list!)).toEqual([]);
  expect(driver.emitted._f).toEqual([]);
});

describe.each(depths)('invalid template constraints at depth %i', (depth) => {
  it.each(['single', 'multi'] as const)(
    '%s field problems name the containing occurrence and survive value edits',
    (cardinality) => {
      const fixture = nested(
        { kind: kind('text'), name: 'f', cardinality, minItems: 0 },
        cardinality === 'multi' ? [{ '@value': 'ok' }] : { '@value': 'ok' },
        depth,
      );
      let schema = fixture.template as any;
      for (const segment of fixture.path.slice(0, -1)) schema = schema.properties[segment].items;
      const field = cardinality === 'multi' ? schema.properties._f.items : schema.properties._f;
      field._valueConstraints.regex = '[';
      const driver = new CeeDriver(fixture.template, { instance: fixture.instance });
      const problem = () =>
        driver.qualityReport.problems.filter((p: ValidationProblem) => p.code === 'templateConstraint');
      expect(problem()).toContainEqual(
        expect.objectContaining({ path: fixture.path, occurrences: fixture.occurrences, severity: 'error' }),
      );
      const initial = problem();
      fixture.path
        .slice(0, -1)
        .forEach((_step, index) =>
          driver.handlerContext.setCurrentIndex(driver.findOrThrow(fixture.path.slice(0, index + 1)), 1),
        );
      driver.setValue(fixture.path, kind('text'), 'another value');
      expect(problem()).toEqual(initial);
      expect(driver.qualityReport.isValid).toBe(false);
      field._valueConstraints.regex = '.*';
      expect(new CeeDriver(fixture.template, { instance: driver.emitted }).qualityReport.isValid).toBe(true);
    },
  );
});

describe.each([1, 3, 6])('malformed element occurrences at depth %i', (depth) => {
  describe.each(['single', 'multi'] as const)('%s elements', (cardinality) => {
    it.each([
      { '@value': 'not an element' },
      { '@id': 'https://example.org/not-an-element' },
      { 'rdfs:label': 'discarded' },
    ])('reports and repairs %j through an explicit child edit', (bad) => {
      const fixture = nested({ kind: kind('text'), name: 'f' }, { '@value': 'ok' }, depth, cardinality);
      let container = fixture.instance as any;
      for (const segment of fixture.path.slice(0, -2))
        container = cardinality === 'multi' ? container[segment][1] : container[segment];
      if (cardinality === 'multi') container[fixture.path.at(-2)!][1] = bad;
      else container[fixture.path.at(-2)!] = bad;
      const supplied = JSON.stringify(fixture.instance);
      const driver = new CeeDriver(fixture.template, { instance: fixture.instance });
      expect(driver.qualityReport.problems).toContainEqual(
        expect.objectContaining({
          code: 'valueShape',
          path: fixture.path.slice(0, -1),
          occurrences: fixture.occurrences,
          severity: 'error',
        }),
      );
      expect(JSON.stringify(fixture.instance)).toBe(supplied);
      if (cardinality === 'multi')
        fixture.path
          .slice(0, -1)
          .forEach((_step, index) =>
            driver.handlerContext.setCurrentIndex(driver.findOrThrow(fixture.path.slice(0, index + 1)), 1),
          );
      driver.setValue(fixture.path, kind('text'), 'repaired');
      expect(driver.qualityReport.isValid, JSON.stringify(driver.qualityReport)).toBe(true);
      expect(new CeeDriver(fixture.template, { instance: driver.emitted }).qualityReport.isValid).toBe(true);
    });
  });
});

it('copying a named attribute preserves its rejected rename independently', () => {
  const driver = new CeeDriver(
    buildTemplate({
      name: 'copy_draft',
      children: [{ kind: kind('attrValue'), name: 'f', cardinality: 'multi', minItems: 0, maxItems: 5 }],
    }),
  );
  const field = driver.findOrThrow(['_f']);
  driver.handlerContext.addMultiInstance(field);
  driver.handlerContext.changeAttributeValue(field, 'accepted', 'stored');
  driver.handlerContext.changeAttributeValue(field, '@id', 'pending');
  driver.handlerContext.copyMultiInstance(field);
  expect(driver.qualityReport.problems.filter((p: ValidationProblem) => p.code === 'attributeName')).toHaveLength(2);
  expect(driver.handlerContext.validation.draftFor(field)?.value).toEqual({ key: '@id', value: 'pending' });
  driver.handlerContext.changeAttributeValue(field, 'fixed', 'pending');
  expect(driver.qualityReport.problems.filter((p: ValidationProblem) => p.code === 'attributeName')).toHaveLength(1);
  driver.handlerContext.setCurrentIndex(field, 0);
  expect(driver.handlerContext.validation.draftFor(field)?.value).toEqual({ key: '@id', value: 'pending' });
});
