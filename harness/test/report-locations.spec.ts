/**
 * Where each problem in the data quality report is.
 *
 * A component path names one place per entry of every repeating component above
 * it, so a report that located problems by path alone could not say which entry
 * held a bad value. It also merged the same bad value in two entries into one
 * problem, and judged a list inside a repeating element by the entry the user
 * happened to be looking at. A host taking the user to a problem needs the entry,
 * and so does the field showing it.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { containerValue, heldValue, instanceWith, listValue, literalValue, templateIdOf } from '../src/values';

const kind = (key: string) => FIELD_KINDS.find((k) => k.key === key)!;
const EMAIL = kind('email');
const LINK = kind('link');
const TEXT = kind('text');
const CHECKBOX = kind('checkbox');

const BAD_EMAIL = 'not-an-email';

const reportOf = (template: object, values: Record<string, any>) => {
  const driver = new CeeDriver(template, {
    instance: instanceWith(templateIdOf(template), values, 'https://example.org/i/located'),
  });
  driver.handlerContext.buildQualityReport();
  return driver;
};

const located = (driver: CeeDriver) =>
  driver.qualityReport.problems.map((p: any) => ({ code: p.code, path: p.path, occurrences: p.occurrences }));

describe('problem locations', () => {
  it('reports the same bad value in two entries of an element as two problems', () => {
    const template = buildTemplate({
      name: 'two_entries',
      elements: [{ name: 'person', cardinality: 'multi', minItems: 0, children: [{ kind: EMAIL, name: 'email' }] }],
    });
    const driver = reportOf(template, {
      _person: listValue(
        containerValue({ _email: literalValue(BAD_EMAIL) }),
        containerValue({ _email: literalValue(BAD_EMAIL) }),
      ),
    });

    expect(located(driver)).toEqual([
      { code: 'email', path: ['_person', '_email'], occurrences: [0] },
      { code: 'email', path: ['_person', '_email'], occurrences: [1] },
    ]);
  });

  it('locates a value inside nested repeating elements by both entries', () => {
    const template = buildTemplate({
      name: 'nested_entries',
      elements: [
        {
          name: 'outer',
          cardinality: 'multi',
          minItems: 0,
          elements: [{ name: 'inner', cardinality: 'multi', minItems: 0, children: [{ kind: EMAIL, name: 'email' }] }],
        },
      ],
    });
    const good = () => containerValue({ _email: literalValue('someone@example.org') });
    const driver = reportOf(template, {
      _outer: listValue(
        containerValue({ _inner: listValue(good()) }),
        containerValue({ _inner: listValue(good(), good(), containerValue({ _email: literalValue(BAD_EMAIL) })) }),
      ),
    });

    expect(located(driver)).toEqual([{ code: 'email', path: ['_outer', '_inner', '_email'], occurrences: [1, 2] }]);
    // The location is the one CEE's own cursor-free walk resolves.
    expect(heldValue(driver.handlerContext.getDataObjectNodeAt(['_outer', '_inner', '_email'], [1, 2]))).toBe(
      BAD_EMAIL,
    );
  });

  it('locates an entry of a repeating field, inside and outside a repeating element', () => {
    const template = buildTemplate({
      name: 'field_entries',
      children: [{ kind: EMAIL, name: 'contact', cardinality: 'multi', minItems: 0 }],
      elements: [
        {
          name: 'person',
          cardinality: 'multi',
          minItems: 0,
          children: [{ kind: EMAIL, name: 'email', cardinality: 'multi', minItems: 0 }],
        },
      ],
    });
    const driver = reportOf(template, {
      _contact: listValue(literalValue('someone@example.org'), literalValue(BAD_EMAIL)),
      _person: listValue(
        containerValue({ _email: listValue(literalValue('someone@example.org')) }),
        containerValue({ _email: listValue(literalValue('someone@example.org'), literalValue(BAD_EMAIL)) }),
      ),
    });

    expect(located(driver)).toEqual([
      { code: 'email', path: ['_contact'], occurrences: [1] },
      { code: 'email', path: ['_person', '_email'], occurrences: [1, 1] },
    ]);
  });

  it('reports every problem in an instance that has several', () => {
    const template = buildTemplate({
      name: 'several',
      children: [
        { kind: EMAIL, name: 'email' },
        { kind: LINK, name: 'link' },
      ],
    });
    const driver = reportOf(template, {
      _email: literalValue(BAD_EMAIL),
      _link: literalValue('https://a'),
    });

    expect(located(driver).map((p: any) => p.code)).toEqual(['email', 'link']);
  });

  it('judges a list inside each entry of an element by that entry, whatever is on screen', () => {
    const template = buildTemplate({
      name: 'per_entry_count',
      elements: [
        {
          name: 'person',
          cardinality: 'multi',
          minItems: 0,
          children: [{ kind: TEXT, name: 'alias', cardinality: 'multi', minItems: 2 }],
        },
      ],
    });
    const driver = reportOf(template, {
      _person: listValue(
        containerValue({ _alias: listValue(literalValue('a'), literalValue('b')) }),
        containerValue({ _alias: listValue(literalValue('c')) }),
      ),
    });
    const person = driver.findOrThrow(['_person']);

    const seen = [0, 1].map((index) => {
      driver.handlerContext.setCurrentIndex(person, index);
      driver.handlerContext.buildQualityReport();
      return located(driver);
    });

    expect(seen[0]).toEqual([{ code: 'minItems', path: ['_person', '_alias'], occurrences: [1] }]);
    expect(seen[1]).toEqual(seen[0]);
  });

  it('names no entry for a required field, since any entry would satisfy it', () => {
    const template = buildTemplate({
      name: 'required_in_entries',
      elements: [
        {
          name: 'person',
          cardinality: 'multi',
          minItems: 0,
          children: [{ kind: TEXT, name: 'name', required: true }],
        },
      ],
    });
    const driver = reportOf(template, {
      _person: listValue(containerValue({ _name: literalValue(null) }), containerValue({ _name: literalValue(null) })),
    });

    expect(located(driver)).toEqual([{ code: 'required', path: ['_person', '_name'], occurrences: [] }]);
  });

  it("does not number a checkbox group's selections, which are one value", () => {
    const template = buildTemplate({
      name: 'selections',
      children: [{ kind: CHECKBOX, name: 'pick', options: [{ label: 'Option A' }, { label: 'Option B' }] }],
    });
    const driver = reportOf(template, {
      _pick: listValue(literalValue('Option A'), literalValue('Option Z')),
    });

    expect(located(driver)).toEqual([{ code: 'choiceMembership', path: ['_pick'], occurrences: [] }]);
  });
});
