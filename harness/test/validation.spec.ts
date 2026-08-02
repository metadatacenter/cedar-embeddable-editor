/**
 * The data quality report's constraint checking.
 *
 * The report used to validate presence and nothing else. Eighteen measured
 * constraint violations — malformed email, text outside its length bounds, a
 * regex mismatch, numeric out of range, garbage temporal values, a choice value
 * outside its literals, cardinality bounds — all reported `isValid: true`,
 * while sixteen widget components rendered `mat-error` for the same data. The
 * form said red and the report said fine, simultaneously.
 *
 * `FieldValueValidator` closes that. It is pure and framework-free so the
 * widgets can eventually call it too: two of the defects found in this codebase
 * were a second place deciding independently what the first had already
 * decided, and three parallel notions of validity is how that recurs.
 *
 * Controlled-term *membership* is deliberately absent — it needs the
 * terminology server. Structural checks on controlled values are here.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, NumberType, TemporalGranularity, TemporalType } from 'cedar-model-typescript-library';
import { FieldKind, FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const TEXT = FIELD_KINDS.find((k) => k.inputType === 'textfield')!;
const CONTROLLED = FIELD_KINDS.find((k) => k.inputType === 'controlled')!;

let seq = 0;
const kindOf = (inputType: string, make: () => any, configure?: (b: any) => any): FieldKind => ({
  key: `v${seq++}`,
  inputType,
  make,
  isStatic: false,
  write: 'value',
  sample: 'x',
  configure,
});

/** Write a value and return the report's problem codes. */
const codesFor = (kind: FieldKind, value: string): string[] => {
  const driver = new CeeDriver(buildTemplate({ name: kind.key, children: [{ kind, name: 'f' }] }));
  driver.setValue(['_f'], kind, value);
  return driver.qualityReport.problems.map((p: any) => p.code);
};

const numeric = (configure: (b: any) => any) => kindOf('numeric', () => CedarBuilders.numericFieldBuilder(), configure);
const temporal = (type: any, granularity: any, timezone = false) =>
  kindOf(
    'temporal',
    () => CedarBuilders.temporalFieldBuilder(),
    (b) => b.withTemporalType(type).withTemporalGranularity(granularity).withTimezoneEnabled(timezone),
  );
const text = (configure?: (b: any) => any) => kindOf('textfield', () => CedarBuilders.textFieldBuilder(), configure);

describe('numeric constraints', () => {
  it.each([
    ['xsd:int given "abc"', () => numeric((b) => b.withNumberType(NumberType.INT)), 'abc', 'numberType'],
    ['xsd:int given "3.7"', () => numeric((b) => b.withNumberType(NumberType.INT)), '3.7', 'numberType'],
    ['xsd:int over INT_MAX', () => numeric((b) => b.withNumberType(NumberType.INT)), '2147483648', 'numberType'],
    [
      'minValue 0 maxValue 10, given 999',
      () => numeric((b) => b.withNumberType(NumberType.INT).withMinValue(0).withMaxValue(10)),
      '999',
      'maxValue',
    ],
    ['minValue 5, given 1', () => numeric((b) => b.withNumberType(NumberType.INT).withMinValue(5)), '1', 'minValue'],
    [
      'decimalPlaces 2, given 1.23456',
      () => numeric((b) => b.withNumberType(NumberType.DOUBLE).withDecimalPlaces(2)),
      '1.23456',
      'decimalPlace',
    ],
  ])('%s → %s', (_label, make, value, code) => {
    expect(codesFor(make(), value)).toContain(code);
  });

  /**
   * The three types CEE previously had no constants for. They fell through
   * every branch of the widget's `if` chain and were checked nowhere.
   */
  it.each([
    ['xsd:byte out of range', NumberType.BYTE, '999'],
    ['xsd:short out of range', NumberType.SHORT, '99999'],
    ['xsd:decimal given text', NumberType.DECIMAL, 'abc'],
    ['xsd:byte given text', NumberType.BYTE, 'abc'],
  ])('%s is now caught', (_label, type, value) => {
    expect(
      codesFor(
        numeric((b) => b.withNumberType(type)),
        value,
      ).length,
    ).toBeGreaterThan(0);
  });

  it.each([
    ['int', NumberType.INT, '42'],
    ['long', NumberType.LONG, '-9000'],
    ['byte', NumberType.BYTE, '127'],
    ['short', NumberType.SHORT, '-32768'],
    ['double', NumberType.DOUBLE, '1.5'],
    ['decimal', NumberType.DECIMAL, '0.25'],
  ])('accepts a valid %s', (_label, type, value) => {
    expect(
      codesFor(
        numeric((b) => b.withNumberType(type)),
        value,
      ),
    ).toEqual([]);
  });

  it('accepts a value at the exact bound', () => {
    const k = numeric((b) => b.withNumberType(NumberType.INT).withMinValue(0).withMaxValue(10));
    expect(codesFor(k, '0')).toEqual([]);
    expect(codesFor(k, '10')).toEqual([]);
  });
});

describe('temporal constraints', () => {
  it.each([
    [
      'granularity=year given a full datetime',
      () => temporal(TemporalType.DATETIME, TemporalGranularity.YEAR),
      '2026-08-02T10:30:00',
      'temporalGranularity',
    ],
    [
      'granularity=second with no seconds',
      () => temporal(TemporalType.DATETIME, TemporalGranularity.SECOND),
      '2026-08-02T10:30',
      'temporalGranularity',
    ],
    ['xsd:date given a time', () => temporal(TemporalType.DATE, TemporalGranularity.DAY), '10:30:00', 'temporalType'],
    [
      'xsd:time given a date',
      () => temporal(TemporalType.TIME, TemporalGranularity.MINUTE),
      '2026-08-02',
      'temporalType',
    ],
    [
      'a garbage string',
      () => temporal(TemporalType.DATETIME, TemporalGranularity.DAY),
      'not a date at all',
      'temporalType',
    ],
    ['month 13, day 40', () => temporal(TemporalType.DATE, TemporalGranularity.DAY), '2026-13-40', 'temporalCalendar'],
    ['hour 99', () => temporal(TemporalType.TIME, TemporalGranularity.MINUTE), '99:30', 'temporalCalendar'],
    [
      'an offset when timezone is disabled',
      () => temporal(TemporalType.DATETIME, TemporalGranularity.MINUTE, false),
      '2026-08-02T10:30-08:00',
      'timezone',
    ],
  ])('%s → %s', (_label, make, value, code) => {
    expect(codesFor(make(), value)).toContain(code);
  });

  it.each([
    ['a valid date', () => temporal(TemporalType.DATE, TemporalGranularity.DAY), '2026-08-02'],
    ['a valid time', () => temporal(TemporalType.TIME, TemporalGranularity.MINUTE), '10:30'],
    ['a valid dateTime', () => temporal(TemporalType.DATETIME, TemporalGranularity.SECOND), '2026-08-02T10:30:00'],
    [
      'an offset when timezone is enabled',
      () => temporal(TemporalType.DATETIME, TemporalGranularity.SECOND, true),
      '2026-08-02T10:30:00-08:00',
    ],
    ['29 February in a leap year', () => temporal(TemporalType.DATE, TemporalGranularity.DAY), '2024-02-29'],
  ])('accepts %s', (_label, make, value) => {
    expect(codesFor(make(), value)).toEqual([]);
  });

  it('rejects 29 February in a non-leap year', () => {
    expect(codesFor(temporal(TemporalType.DATE, TemporalGranularity.DAY), '2026-02-29')).toContain('temporalCalendar');
  });
});

describe('text and format constraints', () => {
  it.each([
    ['minLength 8 given "abc"', () => text((b) => b.withMinLength(8)), 'abc', 'minLength'],
    ['maxLength 3 given 8 characters', () => text((b) => b.withMaxLength(3)), 'abcdefgh', 'maxLength'],
    ['regex mismatch', () => text((b) => b.withRegex('^[A-Z]{3}$')), 'zzz', 'regex'],
    ['a malformed email', () => kindOf('email', () => CedarBuilders.emailFieldBuilder()), 'not-an-email', 'email'],
    ['a non-URI link', () => kindOf('link', () => CedarBuilders.linkFieldBuilder()), 'totally not a uri', 'link'],
    [
      'a nonsense phone number',
      () => kindOf('phone-number', () => CedarBuilders.phoneNumberFieldBuilder()),
      '!!!',
      'phoneNumber',
    ],
    [
      'a non-IRI ORCID',
      () => kindOf('ext-orcid', () => CedarBuilders.extOrcidFieldBuilder()),
      'banana',
      'iriMalformed',
    ],
    ['a non-IRI DOI', () => kindOf('ext-doi', () => CedarBuilders.extDoiFieldBuilder()), 'nope', 'iriMalformed'],
  ])('%s → %s', (_label, make, value, code) => {
    expect(codesFor(make(), value)).toContain(code);
  });

  it.each([
    ['a matching regex', () => text((b) => b.withRegex('^[A-Z]{3}$')), 'ZZZ'],
    ['a valid email', () => kindOf('email', () => CedarBuilders.emailFieldBuilder()), 'someone@example.org'],
    ['a valid link', () => kindOf('link', () => CedarBuilders.linkFieldBuilder()), 'https://example.org/x'],
    [
      'a valid ORCID IRI',
      () => kindOf('ext-orcid', () => CedarBuilders.extOrcidFieldBuilder()),
      'https://orcid.org/0000-0002-1825-0097',
    ],
    ['length exactly at the bounds', () => text((b) => b.withMinLength(3).withMaxLength(3)), 'abc'],
  ])('accepts %s', (_label, make, value) => {
    expect(codesFor(make(), value)).toEqual([]);
  });

  it('ignores an unparseable regex rather than failing every value', () => {
    // A broken pattern is the template's problem; it must not make every
    // instance invalid.
    expect(
      codesFor(
        text((b) => b.withRegex('[unclosed')),
        'anything',
      ),
    ).toEqual([]);
  });
});

describe('choice membership', () => {
  const radio = (labels: string[]) =>
    kindOf(
      'radio',
      () => CedarBuilders.radioFieldBuilder(),
      (b) => labels.reduce((acc, l) => acc.addRadioOption(l, false), b),
    );

  it('reports a value outside the declared literals', () => {
    expect(codesFor(radio(['Alpha', 'Beta']), 'Zeta')).toContain('choiceMembership');
  });

  it('accepts a value among them', () => {
    expect(codesFor(radio(['Alpha', 'Beta']), 'Alpha')).toEqual([]);
  });
});

describe('cardinality', () => {
  const bounded = () =>
    buildTemplate({
      name: 'card',
      elements: [{ name: 'el', cardinality: 'multi', minItems: 2, maxItems: 3, children: [{ kind: TEXT, name: 'f' }] }],
    });

  /**
   * The handlers now refuse to cross a bound, so these violations can only
   * arrive in an injected instance — which is exactly the case the report's
   * cardinality check exists for.
   */
  it('refuses to delete below minItems', () => {
    const driver = new CeeDriver(bounded());
    const el = driver.findOrThrow(['_el']);
    expect(driver.handlerContext.deleteMultiInstance(el)).toBe(false);
    expect(driver.extract._el).toHaveLength(2);
  });

  it('refuses to add past maxItems', () => {
    const driver = new CeeDriver(bounded());
    const el = driver.findOrThrow(['_el']);
    expect(driver.handlerContext.addMultiInstance(el)).toBe(true);
    expect(driver.handlerContext.addMultiInstance(el)).toBe(false);
    expect(driver.extract._el).toHaveLength(3);
  });

  it('refuses to copy past maxItems', () => {
    const driver = new CeeDriver(bounded());
    const el = driver.findOrThrow(['_el']);
    expect(driver.handlerContext.copyMultiInstance(el)).toBe(true);
    expect(driver.handlerContext.copyMultiInstance(el)).toBe(false);
    expect(driver.extract._el).toHaveLength(3);
  });

  it('reports too few instances in an injected instance', () => {
    const template = bounded();
    const seed = new CeeDriver(template);
    const instance: any = seed.metadata;
    instance._el = [instance._el[0]];

    const driver = new CeeDriver(template, { instance });
    expect(driver.qualityReport.problems.map((p: any) => p.code)).toContain('minItems');
  });

  it('reports too many instances in an injected instance', () => {
    const template = bounded();
    const seed = new CeeDriver(template);
    const instance: any = seed.metadata;
    instance._el = [...instance._el, ...instance._el, ...instance._el];

    const driver = new CeeDriver(template, { instance });
    expect(driver.qualityReport.problems.map((p: any) => p.code)).toContain('maxItems');
  });

  it('accepts a count within the bounds', () => {
    expect(new CeeDriver(bounded()).qualityReport.problems).toEqual([]);
  });

  it('reports a multi field below its minItems', () => {
    const template = buildTemplate({
      name: 'cardf',
      children: [{ kind: TEXT, name: 'f', cardinality: 'multi', minItems: 3, maxItems: 4 }],
    });
    const seed = new CeeDriver(template);
    const instance: any = seed.metadata;
    instance._f = [{ '@value': 'only one' }];

    const driver = new CeeDriver(template, { instance });
    expect(driver.qualityReport.problems.map((p: any) => p.code)).toContain('minItems');
  });
});

describe('controlled term structure', () => {
  /**
   * Membership in the declared ontologies, value sets, classes or branches is
   * out of scope — it needs the terminology server, and a local report that
   * quietly skipped the call would be worse than one that never claimed to make
   * it. What is checkable locally is the shape.
   */
  const withNode = (node: unknown) => {
    const template = buildTemplate({ name: `ct${seq++}`, children: [{ kind: CONTROLLED, name: 'f' }] });
    const seed = new CeeDriver(template);
    seed.setValue(['_f'], CONTROLLED);
    const instance: any = seed.metadata;
    instance._f = node;
    return new CeeDriver(template, { instance }).qualityReport.problems.map((p: any) => p.code);
  };

  it('reports an @id with no label', () => {
    expect(withNode({ '@id': 'https://example.org/t/1' })).toContain('controlledStructure');
  });

  it('reports a label with no @id', () => {
    expect(withNode({ 'rdfs:label': 'Some Term' })).toContain('controlledStructure');
  });

  it('reports a malformed @id', () => {
    expect(withNode({ '@id': 'banana', 'rdfs:label': 'Banana' })).toContain('iriMalformed');
  });

  it('accepts a well-formed pair', () => {
    expect(withNode({ '@id': 'https://example.org/t/1', 'rdfs:label': 'Term' })).toEqual([]);
  });

  it('does not attempt membership, so an unrelated term passes', () => {
    // Pinned so the boundary is explicit rather than an accident: this term
    // belongs to no declared ontology and is still accepted.
    expect(withNode({ '@id': 'https://example.org/not-in-any-ontology', 'rdfs:label': 'Elsewhere' })).toEqual([]);
  });
});

describe('problem diagnostics', () => {
  it('names the field, path, input type and code', () => {
    const kind = numeric((b) => b.withNumberType(NumberType.INT).withMaxValue(10));
    const driver = new CeeDriver(
      buildTemplate({
        name: 'diag',
        elements: [{ name: 'el', children: [{ kind, name: 'age' }] }],
      }),
    );
    driver.setValue(['_el', '_age'], kind, '999');

    const [problem] = driver.qualityReport.problems;
    expect(problem.path).toEqual(['_el', '_age']);
    expect(problem.field).toBe('_age');
    expect(problem.inputType).toBe('numeric');
    expect(problem.code).toBe('maxValue');
    expect(problem.message).toContain('10');
    expect(problem.value).toBe('999');
  });

  it('is empty and valid for a well-formed instance', () => {
    const driver = new CeeDriver(
      buildTemplate({ name: 'clean', children: [{ kind: TEXT, name: 'f', required: true }] }),
    );
    driver.setValue(['_f'], TEXT, 'fine');

    expect(driver.qualityReport.problems).toEqual([]);
    expect(driver.qualityReport.isValid).toBe(true);
  });

  it('keeps the legacy counters alongside the new list', () => {
    // Existing embedders read these two integers; they must not change meaning.
    const driver = new CeeDriver(
      buildTemplate({ name: 'legacy', children: [{ kind: TEXT, name: 'f', required: true }] }),
    );
    expect(driver.qualityReport.requiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
  });

  it('does not report constraint problems for an empty value', () => {
    // Absence is the required check's business. A blank field must not also be
    // reported as malformed, or every empty form would produce noise.
    const kind = numeric((b) => b.withNumberType(NumberType.INT).withMinValue(5));
    const driver = new CeeDriver(buildTemplate({ name: 'blank', children: [{ kind, name: 'f' }] }));
    expect(driver.qualityReport.problems).toEqual([]);
  });

  it('reports a violation on any instance, not only the displayed page', () => {
    const kind = numeric((b) => b.withNumberType(NumberType.INT).withMaxValue(10));
    const driver = new CeeDriver(
      buildTemplate({
        name: 'pagedprob',
        elements: [{ name: 'el', cardinality: 'multi', minItems: 3, children: [{ kind, name: 'n' }] }],
      }),
    );
    const el = driver.findOrThrow(['_el']);
    driver.handlerContext.setCurrentIndex(el, 2);
    driver.setValue(['_el', '_n'], kind, '999');

    driver.handlerContext.setCurrentIndex(el, 0);
    driver.handlerContext.buildQualityReport();

    expect(driver.qualityReport.problems.map((p: any) => p.code)).toContain('maxValue');
  });
});
