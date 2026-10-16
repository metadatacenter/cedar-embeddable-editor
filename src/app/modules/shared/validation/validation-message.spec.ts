import { describeValidationProblem } from './validation-message';
import { ValidationProblem } from './validation-problem.model';
import { SingleFieldComponent } from '../models/field/single-field-component.model';
import en from '../../../../assets/i18n-cee/en.json';
import hu from '../../../../assets/i18n-cee/hu.json';

const problem = (code: string) => new ValidationProblem(['_field'], '_field', 'textfield', code, 'technical detail');
const translation = (map: unknown, key: string): unknown =>
  key.split('.').reduce((value, part) => (value as Record<string, unknown>)[part], map);

describe('user-facing validation explanations', () => {
  it('provides English and Hungarian messages for every supported code', () => {
    const field = new SingleFieldComponent();
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
    ]) {
      const diagnostic = problem(code);
      const message = describeValidationProblem(diagnostic, field);
      expect(translation(en, message.key), code).toEqual(expect.any(String));
      expect(translation(hu, message.key), code).toEqual(expect.any(String));
      expect(diagnostic.message).toBe('technical detail');
    }
  });
  it('uses the field constraints and singular forms without trying to translate arbitrary regular expressions', () => {
    const field = new SingleFieldComponent();
    field.valueInfo.minLength = 1;
    field.valueInfo.maxLength = 8;
    field.valueInfo.regex = '^HBM[0-9]{3}$';
    expect(describeValidationProblem(problem('minLength'), field)).toEqual({
      key: 'Validation.Text.MinLengthOne',
      params: { constraintMinLength: 1 },
    });
    expect(describeValidationProblem(problem('maxLength'), field)).toEqual({
      key: 'Validation.Text.MaxLength',
      params: { constraintMaxLength: 8 },
    });
    expect(describeValidationProblem(problem('regex'), field)).toEqual({ key: 'Validation.Text.Pattern' });
    expect(describeValidationProblem(problem('templateMismatch'))).toEqual({
      key: 'Validation.Report.TemplateMismatch',
    });
  });
});
