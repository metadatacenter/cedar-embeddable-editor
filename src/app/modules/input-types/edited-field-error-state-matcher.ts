import { AbstractControl, FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

/**
 * Whether the control holds an error other than an unanswered requirement.
 *
 * Such an error describes a value that is there, whoever put it there. A value
 * loaded from a stored instance is neither dirty nor touched, so a rule that waited
 * for either showed nothing under a field the data quality report listed as wrong.
 * An empty required field is different: on a form nobody has started, every one of
 * them would speak at once, so it waits until the user reaches it.
 */
export function holdsConstraintError(control: AbstractControl | null): boolean {
  return Object.keys(control?.errors ?? {}).some((key) => key !== 'required');
}

/** Show invalid values as soon as they are there, keeping untouched required fields quiet. */
export class EditedFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(
      control?.invalid &&
      (control.dirty || control.touched || form?.submitted || holdsConstraintError(control))
    );
  }
}
