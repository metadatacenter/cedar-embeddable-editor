import { CedarComponent } from '../models/component/cedar-component.model';
import { AbstractFieldComponent } from '../models/field/abstract-field-component.model';
import { MultiInfo } from '../models/info/multi-info.model';
import { Translatable } from '../models/ui/translatable.model';
import { countKey } from '../util/count-key';
import { ValidationCode, ValidationProblem } from './validation-problem.model';
import { CedarValidators } from './cedar-validators';

/** What a component with a list declares about its length. */
type Bounded = CedarComponent & { multiInfo?: MultiInfo };

/**
 * How each problem a widget cannot state is put to the user.
 *
 * A widget states what its own control finds wrong. Some of what the data quality
 * report finds has no control to find it: a stored choice that is not one of the
 * options, a term missing half of itself, an identifier that is not an IRI, and a
 * list of the wrong length. Without this, those appeared in a host's list of
 * problems and nowhere on the form.
 */
export const REPORT_NOTICES: Partial<Record<string, (problem: ValidationProblem, component: Bounded) => Translatable>> =
  {
    [ValidationCode.templateConstraint]: () => ({ key: 'Validation.Report.TemplateConstraint' }),
    [ValidationCode.valueShape]: (problem) => ({
      key: problem.inputType === 'element' ? 'Validation.Report.ElementShape' : 'Validation.Report.ValueShape',
    }),
    [ValidationCode.attributeName]: () => ({ key: 'Validation.Report.AttributeName' }),
    [ValidationCode.choiceMembership]: (problem) => ({
      key: 'Validation.Report.ChoiceMembership',
      params: { value: String(problem.value ?? '') },
    }),
    [ValidationCode.controlledStructure]: () => ({ key: 'Validation.Report.ControlledStructure' }),
    [ValidationCode.iriMalformed]: () => ({ key: 'Validation.Report.IriMalformed' }),
    [ValidationCode.minItems]: (_problem, component) => ({
      key: countKey('Validation.Report.MinItems', component.multiInfo?.minItems ?? 0),
      params: { min: component.multiInfo?.minItems ?? 0 },
    }),
    [ValidationCode.maxItems]: (_problem, component) => ({
      key: countKey('Validation.Report.MaxItems', component.multiInfo?.maxItems ?? 0),
      params: { max: component.multiInfo?.maxItems ?? 0 },
    }),
  };

/** User-facing copy shared by the inline notices and the public quality report.
 * The diagnostic message remains untouched for logs and technical details. */
export function describeValidationProblem(problem: ValidationProblem, component?: CedarComponent): Translatable {
  if (component && REPORT_NOTICES[problem.code]) return REPORT_NOTICES[problem.code]!(problem, component);
  const field = component instanceof AbstractFieldComponent ? component : undefined;
  const simple: Record<string, string> = {
    required: 'Validation.Required',
    controlledTermMembership: 'Validation.Report.ControlledTermMembership',
    authorityIdentifier: 'Validation.Report.AuthorityIdentifier',
    authorityMembership: 'Validation.Report.AuthorityMembership',
    semanticNotChecked: 'Validation.Report.SemanticNotChecked',
    semanticUnavailable: 'Validation.Report.SemanticUnavailable',
    regex: 'Validation.Text.Pattern',
    regexEvaluation: 'Validation.Text.PatternUnavailable',
    email: 'Validation.Email.Invalid',
    link: 'Validation.Link.Invalid',
    phoneNumber: 'Validation.Phone.Invalid',
    incompleteValue: 'Validation.Report.IncompleteValue',
    templateMismatch: 'Validation.Report.TemplateMismatch',
    temporalGranularity: 'Validation.Temporal.Granularity',
    timezone: 'Validation.Temporal.UnexpectedTimezone',
    timezoneOffset: 'Validation.Temporal.InvalidTimezoneOffset',
  };
  if (simple[problem.code]) return { key: simple[problem.code] };
  if (field) {
    if (problem.code === 'minLength' || problem.code === 'maxLength') {
      const min = problem.code === 'minLength';
      const count = (min ? field.valueInfo.minLength : field.valueInfo.maxLength) ?? 0;
      return {
        key: countKey('Validation.Text.' + (min ? 'MinLength' : 'MaxLength'), count),
        params: { [min ? 'constraintMinLength' : 'constraintMaxLength']: count },
      };
    }
    if (problem.code === 'minValue' || problem.code === 'maxValue') {
      const min = problem.code === 'minValue';
      const bound = (min ? field.numberInfo.minValue : field.numberInfo.maxValue) ?? 0;
      return {
        key: 'Validation.Numeric.' + (min ? 'MinValue' : 'MaxValue'),
        params: {
          [min ? 'constraintMinValue' : 'constraintMaxValue']: typeof bound === 'number' ? bound : String(bound),
        },
      };
    }
    if (problem.code === 'numberType' || problem.code === 'decimalPlace') {
      return CedarValidators.describeNumberType(field) ?? { key: 'Validation.Invalid' };
    }
    if (problem.code === 'temporalType' || problem.code === 'temporalCalendar') {
      return CedarValidators.describeTemporalCode(problem.code, field);
    }
  }
  return { key: 'Validation.Invalid' };
}
