import { FormControl, FormGroupDirective, NgForm } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

/** Show invalid edits as they are typed, keeping untouched required fields quiet. */
export class EditedFieldErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return !!(control?.invalid && (control.dirty || control.touched || form?.submitted));
  }
}
