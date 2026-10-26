import { NumberType, TemporalGranularity, TemporalType } from 'cedar-model-typescript-library';
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS, FieldKind } from '../src/axes';
import { buildTemplate, ChildSpec, ElementSpec } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { occurrenceContext } from '../src/validation-state-fixtures';
import { ValidationProblem } from '@cee/validation/validation-problem.model';

/**
 * Every problem code a stored value can raise that the validation-state matrix did not reach, under
 * the same treatment: found at its place at every depth, unchanged by moving between entries, left
 * alone in read-only mode, gone once the value is repaired, and gone again when the repaired instance
 * is read back.
 *
 * The validation-state matrix covers the codes a value's shape raises. These are the ones a field's
 * own constraints raise, and the two a list's bounds do: a pattern, the lengths, decimal places, a
 * temporal granularity, a timezone where none is enabled and one out of range, an answer outside the
 * options, a term with half of its identity, and lists too short or too long.
 */
const kind = (key: string): FieldKind => FIELD_KINDS.find((entry) => entry.key === key)!;
const depths = [0, 1, 3, 6];
const modes = [false, true];

/** A field kind with constraints stated on top of the ones it needs to be well formed. */
function constrained(key: string, configure: (builder: any) => any): FieldKind {
  const base = kind(key);
  return { ...base, configure: (builder) => configure(base.configure ? base.configure(builder) : builder) };
}

/**
 * An empty occurrence of an element: its `@context`, as a stored occurrence carries it, and empty
 * answers that still have the structural properties their field declares.
 */
function emptyContainer(schema: any): Record<string, unknown> {
  return {
    '@context': occurrenceContext(schema),
    ...Object.fromEntries(
      (schema._ui.order as string[]).map((key) => {
        const child = schema.properties[key];
        if (child.type === 'array') return [key, []];
        if (!child._ui?.inputType) return [key, emptyContainer(child)];
        if (!child.properties?.['@value']) return [key, {}];
        const datatype = child._valueConstraints?.numberType ?? child._valueConstraints?.temporalType;
        return [key, { '@value': null, ...(datatype ? { '@type': datatype } : {}) }];
      }),
    ),
  };
}

/**
 * Each repeated ancestor has a structurally valid empty sibling and the branch under test at index 1.
 * Every occurrence carries its element's `@context`, as a stored one does, and the value under test is
 * left as given.
 */
function nested(spec: ChildSpec, value: unknown, depth: number) {
  let elements: ElementSpec[] = [];
  let children = [spec];
  const path = ['_f'];
  const occurrences: number[] = [];
  for (let level = depth - 1; level >= 0; level--) {
    const name = `level${level}`;
    elements = [{ name, cardinality: 'multi', minItems: 0, children, elements }];
    children = [];
    path.unshift(`_${name}`);
    occurrences.unshift(1);
  }
  const template = buildTemplate({ name: 'problem_codes', children, elements });
  const branch = (schema: any, keys: string[]): Record<string, unknown> => {
    const [key, ...rest] = keys;
    if (rest.length === 0) return { [key]: value };
    const child = schema.properties[key];
    const element = child.type === 'array' ? child.items : child;
    const occurrence = { '@context': occurrenceContext(element), ...branch(element, rest) };
    return { [key]: child.type === 'array' ? [emptyContainer(element), occurrence] : occurrence };
  };
  const instance = {
    '@context': {},
    'schema:isBasedOn': (template as Record<string, unknown>)['@id'],
    ...branch(template, path),
  };
  return { template, instance, path, occurrences };
}

const options = [{ label: 'Option A' }, { label: 'Option B' }];

const storedValues: Array<{
  name: string;
  kind: FieldKind;
  options?: ChildSpec['options'];
  value: unknown;
  code: string;
  repair: string;
}> = [
  {
    name: 'text that breaks its pattern',
    kind: constrained('text', (b) => b.withRegex('[A-Z]+')),
    value: { '@value': 'lower case' },
    code: 'regex',
    repair: 'UPPER',
  },
  {
    name: 'text shorter than its minimum',
    kind: constrained('text', (b) => b.withMinLength(8)),
    value: { '@value': 'short' },
    code: 'minLength',
    repair: 'long enough',
  },
  {
    name: 'a paragraph shorter than its minimum',
    kind: constrained('textarea', (b) => b.withMinLength(8)),
    value: { '@value': 'short' },
    code: 'minLength',
    repair: 'long enough',
  },
  {
    name: 'text longer than its maximum',
    kind: constrained('text', (b) => b.withMaxLength(5)),
    value: { '@value': 'far too long' },
    code: 'maxLength',
    repair: 'short',
  },
  {
    name: 'a paragraph longer than its maximum',
    kind: constrained('textarea', (b) => b.withMaxLength(5)),
    value: { '@value': 'far too long' },
    code: 'maxLength',
    repair: 'short',
  },
  {
    name: 'a decimal with more places than it allows',
    kind: constrained('numeric', (b) => b.withNumberType(NumberType.DECIMAL).withDecimalPlaces(2)),
    value: { '@value': '1.234', '@type': 'xsd:decimal' },
    code: 'decimalPlace',
    repair: '1.23',
  },
  {
    name: 'a date finer than its granularity',
    kind: constrained('temporal', (b) =>
      b.withTemporalType(TemporalType.DATE).withTemporalGranularity(TemporalGranularity.YEAR),
    ),
    value: { '@value': '2026-08-15', '@type': 'xsd:date' },
    code: 'temporalGranularity',
    repair: '2026-01-01',
  },
  {
    name: 'a timezone where none is enabled',
    kind: kind('temporal'),
    value: { '@value': '2026-08-01+05:00', '@type': 'xsd:date' },
    code: 'timezone',
    repair: '2026-08-01',
  },
  {
    name: 'a timezone offset out of range',
    kind: constrained('temporal', (b) =>
      b
        .withTemporalType(TemporalType.DATETIME)
        .withTemporalGranularity(TemporalGranularity.MINUTE)
        .withTimezoneEnabled(true),
    ),
    value: { '@value': '2026-08-01T10:00+05:60', '@type': 'xsd:dateTime' },
    code: 'timezoneOffset',
    repair: '2026-08-01T10:00+05:30',
  },
  {
    name: 'a radio answer that is not one of its options',
    kind: kind('radio'),
    options,
    value: { '@value': 'Maybe' },
    code: 'choiceMembership',
    repair: 'Option A',
  },
  {
    name: 'a list answer that is not one of its options',
    kind: kind('listSingle'),
    options,
    value: { '@value': 'Maybe' },
    code: 'choiceMembership',
    repair: 'Option A',
  },
  {
    name: 'a term with a label and no IRI',
    kind: kind('controlled'),
    value: { 'rdfs:label': 'Human' },
    code: 'controlledStructure',
    repair: 'Term',
  },
];

describe.each(depths)('stored values that break a constraint, at depth %i', (depth) => {
  describe.each(modes)('readOnly=%s', (readOnlyMode) => {
    it.each(storedValues)('$name is reported, survives navigation and can be repaired', async (test) => {
      const fixture = nested({ kind: test.kind, name: 'f', options: test.options }, test.value, depth);
      const supplied = JSON.stringify(fixture.instance);
      const driver = new CeeDriver(fixture.template, { instance: fixture.instance, readOnlyMode });
      await driver.settled();
      const problem = driver.qualityReport.problems.find((p: ValidationProblem) => p.code === test.code);
      expect(problem, JSON.stringify(driver.qualityReport.problems)).toMatchObject({
        path: fixture.path,
        occurrences: fixture.occurrences,
        severity: ['controlledStructure', 'timezoneOffset'].includes(test.code) ? 'error' : 'warning',
        blocksSave: ['controlledStructure', 'timezoneOffset'].includes(test.code),
      });
      expect(driver.qualityReport.isValid).toBe(false);
      const initial = driver.qualityReport;
      for (let level = 0; level < depth; level++) {
        const parent = driver.findOrThrow(fixture.path.slice(0, level + 1));
        driver.handlerContext.setCurrentIndex(parent, 0);
        driver.handlerContext.buildQualityReport();
        expect(driver.qualityReport).toEqual(initial);
        driver.handlerContext.setCurrentIndex(parent, 1);
      }
      expect(JSON.stringify(fixture.instance)).toBe(supplied);
      if (readOnlyMode) {
        driver.setValue(fixture.path, test.kind, test.repair);
        expect(driver.qualityReport).toEqual(initial);
        driver.handlerContext.readOnlyMode = false;
      }
      driver.setValue(fixture.path, test.kind, test.repair);
      await driver.settled();
      expect(
        driver.qualityReport.problems.filter((p: ValidationProblem) => p.category !== 'verification'),
        JSON.stringify(driver.messages.errors),
      ).toEqual([]);
      expect(driver.qualityReport.canSave).toBe(true);
      const reloaded = new CeeDriver(fixture.template, { instance: driver.emitted, readOnlyMode });
      await reloaded.settled();
      expect(reloaded.qualityReport.isValid).toBe(test.kind.key !== 'controlled');
      expect(reloaded.qualityReport.canSave).toBe(true);
    });
  });
});

const storedLists = [
  {
    name: 'a list shorter than its minimum',
    minItems: 3,
    maxItems: undefined,
    entries: 1,
    code: 'minItems',
    severity: 'warning',
  },
  {
    name: 'a list longer than its maximum',
    minItems: 0,
    maxItems: 1,
    entries: 2,
    code: 'maxItems',
    severity: 'warning',
  },
];

describe.each(depths)('stored lists outside their bounds, at depth %i', (depth) => {
  describe.each(modes)('readOnly=%s', (readOnlyMode) => {
    it.each(storedLists)('$name is reported at its list and survives navigation', (test) => {
      const values = Array.from({ length: test.entries }, (_, index) => ({ '@value': `entry ${index}` }));
      const fixture = nested(
        { kind: kind('text'), name: 'f', cardinality: 'multi', minItems: test.minItems, maxItems: test.maxItems },
        values,
        depth,
      );
      const supplied = JSON.stringify(fixture.instance);
      const driver = new CeeDriver(fixture.template, { instance: fixture.instance, readOnlyMode });
      // The empty sibling of each ancestor holds no entries, so a minimum is short there too; the
      // problem under test is the one at the branch's own entry.
      const problem = driver.qualityReport.problems.find(
        (p: ValidationProblem) =>
          p.code === test.code && JSON.stringify(p.occurrences) === JSON.stringify(fixture.occurrences),
      );
      expect(problem, JSON.stringify(driver.qualityReport.problems)).toMatchObject({
        path: fixture.path,
        occurrences: fixture.occurrences,
        severity: test.severity,
      });
      const initial = driver.qualityReport;
      for (let level = 0; level < depth; level++) {
        const parent = driver.findOrThrow(fixture.path.slice(0, level + 1));
        driver.handlerContext.setCurrentIndex(parent, 0);
        driver.handlerContext.buildQualityReport();
        expect(driver.qualityReport).toEqual(initial);
        driver.handlerContext.setCurrentIndex(parent, 1);
      }
      expect(JSON.stringify(fixture.instance)).toBe(supplied);
      expect(new CeeDriver(fixture.template, { instance: driver.emitted, readOnlyMode }).qualityReport).toEqual(
        initial,
      );
    });
  });
});
