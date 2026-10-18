import { expect, it } from 'vitest';
import { describeValidationProblem } from '@cee/validation/validation-message';
import { ValidationProblem } from '@cee/validation/validation-problem.model';
import { SingleFieldComponent } from '@cee/models/field/single-field-component.model';
import en from '../../src/assets/i18n-cee/en.json';
import hu from '../../src/assets/i18n-cee/hu.json';

const problem = (code: string, input = 'textfield', value: unknown = null) =>
  new ValidationProblem(['_parent', '_value'], '_value', input, code, 'Original diagnostic', value, [2]);
const lookup = (map: unknown, key: string) => key.split('.').reduce((v, k) => (v as Record<string, unknown>)[k], map);
// The host and widgets consume the same domain report. Every explanation must be
// available in both languages without changing the diagnostic or occurrence address.
for (const code of [
  'required',
  'regex',
  'email',
  'link',
  'phoneNumber',
  'incompleteValue',
  'templateMismatch',
  'temporalGranularity',
  'timezone',
  'timezoneOffset',
  'minLength',
  'maxLength',
  'minValue',
  'maxValue',
  'numberType',
  'decimalPlace',
  'temporalType',
  'temporalCalendar',
  'templateConstraint',
  'valueShape',
  'attributeName',
  'choiceMembership',
  'controlledStructure',
  'iriMalformed',
  'minItems',
  'maxItems',
  'unknown',
])
  it(`localizes ${code} while preserving the reported value and address`, () => {
    const field = new SingleFieldComponent(),
      issue = problem(code, 'textfield', 'unrecognized value');
    const before = JSON.stringify(issue),
      message = describeValidationProblem(issue, field);
    expect(lookup(en, message.key)).toEqual(expect.any(String));
    expect(lookup(hu, message.key)).toEqual(expect.any(String));
    expect(JSON.stringify(issue)).toBe(before);
  });
it('states the actual text, number and occurrence bounds, including singular and absent constraints', () => {
  const field = new SingleFieldComponent();
  field.valueInfo.minLength = 1;
  field.valueInfo.maxLength = 12;
  field.numberInfo.minValue = -7;
  field.numberInfo.maxValue = 11;
  field.multiInfo.minItems = 1;
  field.multiInfo.maxItems = 3;
  for (const [code, key, params] of [
    ['minLength', 'Validation.Text.MinLengthOne', { constraintMinLength: 1 }],
    ['maxLength', 'Validation.Text.MaxLength', { constraintMaxLength: 12 }],
    ['minValue', 'Validation.Numeric.MinValue', { constraintMinValue: -7 }],
    ['maxValue', 'Validation.Numeric.MaxValue', { constraintMaxValue: 11 }],
    ['minItems', 'Validation.Report.MinItemsOne', { min: 1 }],
    ['maxItems', 'Validation.Report.MaxItems', { max: 3 }],
  ] as const)
    expect(describeValidationProblem(problem(code), field)).toEqual({ key, params });
  field.numberInfo.numberType = 'xsd:decimal';
  field.numberInfo.decimalPlace = 1;
  expect(describeValidationProblem(problem('decimalPlace'), field)).toEqual({
    key: 'Validation.Numeric.Type.DecimalPlacesOne',
    params: { decimalPlace: 1 },
  });
});
it('distinguishes malformed elements and choices and tolerates unavailable component context', () => {
  const field = new SingleFieldComponent();
  expect(describeValidationProblem(problem('valueShape', 'element'), field).key).toBe('Validation.Report.ElementShape');
  expect(describeValidationProblem(problem('choiceMembership', 'list'), field).params).toEqual({ value: '' });
  expect(describeValidationProblem(problem('templateMismatch')).key).toBe('Validation.Report.TemplateMismatch');
  expect(describeValidationProblem(problem('unknown')).key).toBe('Validation.Invalid');
});
