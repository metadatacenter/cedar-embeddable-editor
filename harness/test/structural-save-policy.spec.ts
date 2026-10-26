import { describe, expect, it } from 'vitest';
import { NumberType } from 'cedar-model-typescript-library';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { instanceWith, templateIdOf } from '../src/values';
import { occurrenceContext } from '../src/validation-state-fixtures';

const text = FIELD_KINDS.find((kind) => kind.key === 'text')!;
const numeric = {
  ...FIELD_KINDS.find((kind) => kind.key === 'numeric')!,
  configure: (builder: any) => builder.withNumberType(NumberType.INT).withMinValue(0).withMaxValue(10),
};

describe('structural defects and saveable value quality', () => {
  it('blocks undeclared artifact properties, including host metadata if a host leaks it into the artifact', () => {
    const template = buildTemplate({ name: 'Declared properties', children: [{ kind: text, name: 'answer' }] });
    for (const property of ['unexpectedAnswer', '$$cedarEtag']) {
      const driver = new CeeDriver(template, {
        instance: {
          ...instanceWith(templateIdOf(template), {}),
          _answer: { '@value': 'An answer' },
          [property]: property === '$$cedarEtag' ? '"7"' : { '@value': 'Not declared by the template' },
        },
      });
      expect(driver.qualityReport).toMatchObject({ structurallyValid: false, canSave: false });
      expect(driver.qualityReport.problems).toContainEqual(
        expect.objectContaining({ code: 'valueShape', location: `/${property}`, blocksSave: true }),
      );
    }
  });

  it('keeps an omitted property blocking even if an export copy fills it, then clears after a real edit', () => {
    const template = buildTemplate({ name: 'Missing property', children: [{ kind: text, name: 'answer' }] });
    const driver = new CeeDriver(template, { instance: instanceWith(templateIdOf(template), {}) });
    expect(driver.qualityReport).toMatchObject({ structurallyValid: false, canSave: false });
    expect(driver.qualityReport.problems).toContainEqual(
      expect.objectContaining({ code: 'missingProperty', path: ['_answer'], location: '/_answer' }),
    );
    expect(driver.emitted._answer).toEqual({ '@value': null });
    driver.handlerContext.buildQualityReport();
    expect(driver.qualityReport.canSave).toBe(false);
    driver.setValue(['_answer'], text, 'An answer');
    expect(driver.qualityReport).toMatchObject({ structurallyValid: true, canSave: true, isValid: true });
  });

  it('distinguishes a typed empty numeric slot, an absent datatype, a malformed number, and a range failure', () => {
    const template = buildTemplate({ name: 'Numeric', children: [{ kind: numeric, name: 'number' }] });
    const cases = [
      [{ '@value': null, '@type': 'xsd:int' }, true, null],
      [{ '@value': null }, false, 'missingProperty'],
      [{ '@value': 'wrong', '@type': 'xsd:int' }, false, 'numberType'],
      [{ '@value': '11', '@type': 'xsd:int' }, true, 'maxValue'],
    ] as const;
    for (const [value, canSave, code] of cases) {
      const driver = new CeeDriver(template, {
        instance: { ...instanceWith(templateIdOf(template), {}), _number: value },
      });
      expect(driver.qualityReport.canSave, JSON.stringify(value)).toBe(canSave);
      if (code) expect(driver.qualityReport.problems).toContainEqual(expect.objectContaining({ code }));
      if (code === 'maxValue') expect(driver.emitted._number).toEqual(value);
    }
  });

  it('locates structural defects in the correct repeated occurrence and escapes exact property pointers', () => {
    const template = buildTemplate({
      name: 'Nested',
      elements: [{ name: 'group', cardinality: 'multi', children: [{ kind: numeric, name: 'a/b~c' }] }],
    });
    const context = occurrenceContext((template as any).properties._group.items);
    const instance = {
      ...instanceWith(templateIdOf(template), {}),
      _group: [
        { '@context': context, '_a/b~c': { '@value': '1', '@type': 'xsd:int' } },
        { '@context': context, '_a/b~c': { '@value': '2' } },
      ],
    };
    const driver = new CeeDriver(template, { instance });
    expect(driver.qualityReport.problems).toContainEqual(
      expect.objectContaining({
        code: 'missingProperty',
        path: ['_group', '_a/b~c'],
        occurrences: [1],
        location: '/_group/1/_a~1b~0c/@type',
      }),
    );
  });
});
