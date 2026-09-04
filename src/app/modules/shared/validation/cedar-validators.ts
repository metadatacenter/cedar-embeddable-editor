import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { Xsd } from '../models/xsd.model';
import { FieldValueValidator } from './field-value-validator';
import { ValidationCode } from './validation-problem.model';

/**
 * Angular adapter for `FieldValueValidator`.
 *
 * The widgets used to declare their constraints as a hand-rolled set of
 * `Validators.*` calls per component, and the data quality report decided
 * validity separately. Two independent notions of "valid" is how a form comes
 * to show a red error while the report says the instance is fine — which it
 * did. This makes the widgets ask the same question the report asks.
 *
 * `required` stays an Angular validator. `FieldValueValidator` deliberately
 * returns nothing for an empty value, because absence is the report's required
 * check's business and constraints describe what a value must look like *if
 * present*.
 */
export class CedarValidators {
  /**
   * Error keys the existing templates already listen for.
   *
   * Emitting both the canonical code and its legacy alias means one validator
   * can replace the hand-rolled ones without rewriting sixteen templates, and
   * without silently dropping the messages users currently see. New codes with
   * no alias still invalidate the control; they need a `mat-error` added before
   * they display a message.
   */
  private static readonly ALIASES: Record<string, string> = {
    [ValidationCode.minLength]: 'minlength',
    [ValidationCode.maxLength]: 'maxlength',
    [ValidationCode.regex]: 'pattern',
    [ValidationCode.link]: 'pattern',
    [ValidationCode.phoneNumber]: 'pattern',
    [ValidationCode.numberType]: 'pattern',
    [ValidationCode.decimalPlace]: 'pattern',
    [ValidationCode.minValue]: 'min',
    [ValidationCode.maxValue]: 'max',
  };

  /**
   * Per-type keys the external authority templates expect.
   *
   * Five of these — PFAS, PubMed, RRID, NIH Grant, DOI — render a `mat-error`
   * bound to a key nothing ever set, because they were copied from the
   * ORCID/ROR pair without the code that raises it. Mapping `iriMalformed`
   * onto those keys brings the existing markup to life rather than leaving it
   * as decoration.
   */
  private static readonly AUTHORITY_KEYS: Record<string, string> = {
    [InputType.orcid]: 'invalidOrcid',
    [InputType.ror]: 'invalidRor',
    [InputType.pfas]: 'invalidPfas',
    [InputType.pmid]: 'invalidPmid',
    [InputType.rrid]: 'invalidRrid',
    [InputType.nihGrant]: 'invalidNihGrant',
    [InputType.doi]: 'invalidDoi',
  };

  /** Every declared constraint for this field, as a single Angular validator. */
  static forComponent(component: FieldComponent): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const problems = FieldValueValidator.validate(component, control.value, component.path ?? []);
      if (problems.length === 0) {
        return null;
      }
      const errors: ValidationErrors = {};
      for (const problem of problems) {
        const detail = { message: problem.message, value: problem.value };
        errors[problem.code] = detail;

        const alias = CedarValidators.ALIASES[problem.code];
        if (alias) {
          errors[alias] = detail;
        }
        if (problem.code === ValidationCode.iriMalformed) {
          // A field with no declared input type is not one of the authority kinds,
          // so it has no key in this map and no error to attach.
          const inputType = component.basicInfo.inputType;
          const key = inputType === null ? undefined : CedarValidators.AUTHORITY_KEYS[inputType];
          if (key) {
            errors[key] = detail;
          }
        }
      }
      return errors;
    };
  }

  /**
   * At least one box ticked, for a required checkbox group.
   *
   * `Validators.required` on a FormGroup passes as soon as the group exists, so
   * it cannot express this — which is why the checkbox widget had no validator
   * and a required checkbox field never showed as unsatisfied.
   *
   * `listControlName` names the control holding the selection, and the check has
   * to go through it. It used to ask whether any of the group's values was
   * `true`, and nothing ever puts a `true` there: the widget writes the string
   * `checked`, and Material's own `true` arrives during the click, before the
   * `input` handler overwrites it. So the group stayed unsatisfied however many
   * boxes were ticked. Testing the values for truthiness instead would not have
   * helped, since one of them is the selection list itself and `[]` is truthy.
   */
  static atLeastOneChecked(listControlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const selected = control.get(listControlName)?.value;
      const anyChecked = Array.isArray(selected) && selected.length > 0;
      return anyChecked ? null : { required: { message: 'Select at least one option.', value: null } };
    };
  }

  /**
   * Hint text describing what a numeric field will accept.
   *
   * The numeric widget shows this next to the field, so it has to stay in step
   * with the pattern actually applied — which is the reason it lives beside the
   * validator rather than in the component.
   *
   * A finished sentence, with nothing for a caller to add. Every branch used to open
   * with a space and the widget closed with a period of its own, so the line rendered
   * indented under the error above it and ended `...(-32768 to 32767)..`; a float with
   * no declared decimal place ended `a float,.`, the comma left waiting for a clause
   * that was never appended.
   *
   * Null for a field whose XSD type carries no hint worth showing.
   */
  static describeNumberType(component: FieldComponent): string | null {
    const numberType = component.numberInfo?.numberType;
    const decimalPlace = component.numberInfo?.decimalPlace ?? null;
    switch (numberType) {
      case Xsd.int:
        return 'The value should be an integer.';
      case Xsd.long:
        return 'The value should be a long integer.';
      case Xsd.byte:
        return 'The value should be a byte (-128 to 127).';
      case Xsd.short:
        return 'The value should be a short (-32768 to 32767).';
      case Xsd.float:
        return CedarValidators.describeFractionalType('float', decimalPlace);
      case Xsd.double:
        return CedarValidators.describeFractionalType('double', decimalPlace);
      case Xsd.decimal:
        return CedarValidators.describeFractionalType('decimal', decimalPlace);
      default:
        return null;
    }
  }

  /**
   * How a field that admits a fractional part reads, given the places it declares.
   *
   * Zero places admits no fraction at all, so naming the XSD type there states the
   * opposite of the constraint: `a decimal with at most 0 decimal places` is a whole
   * number, and reads as a contradiction. That case describes what is allowed instead
   * of what the type is called.
   */
  private static describeFractionalType(typeName: string, decimalPlace: number | null): string {
    if (decimalPlace === null) {
      return `The value should be a ${typeName}.`;
    }
    if (decimalPlace === 0) {
      return 'The value should be a number with no decimal places.';
    }
    const places = decimalPlace === 1 ? 'decimal place' : 'decimal places';
    return `The value should be a ${typeName} with at most ${decimalPlace} ${places}.`;
  }

  /**
   * The message for whichever problem the control currently has.
   *
   * Lets a template render one `mat-error` carrying the validator's own text
   * instead of a hand-written string per constraint, which is what let the
   * messages drift from the checks in the first place.
   */
  static firstMessage(control: AbstractControl): string | null {
    if (!control || !control.errors) {
      return null;
    }
    for (const value of Object.values(control.errors)) {
      if (value && typeof value === 'object' && 'message' in (value as object)) {
        return (value as { message: string }).message;
      }
    }
    return null;
  }
}
