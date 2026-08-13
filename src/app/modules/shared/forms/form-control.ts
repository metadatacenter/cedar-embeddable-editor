import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

/**
 * A form control by name, or a loud failure.
 *
 * `FormGroup.get()` returns `AbstractControl | null` because a caller may ask for a
 * name the group does not have. Under `strictNullChecks` that null has to be dealt
 * with at every call site, and the usual answer — `group.get(name)!` — asserts the
 * control exists without checking, which is the thing an assertion is worst at.
 *
 * Every lookup in CEE asks for a control the component itself just built, so a miss
 * is a programming error rather than a state the UI can reach. Throwing says that,
 * and says it at the point of the mistake instead of as `undefined` three frames
 * later.
 *
 * In `shared/forms/` rather than `shared/util/`, because it imports
 * `@angular/forms` and `shared/util` is one of the directories the domain layer
 * keeps framework-free — that is what lets the harness exercise CEE's domain code
 * with no Angular at all. `import-boundaries.spec.ts` enforces it, and caught this
 * file the first time it was put in the wrong place.
 */
export function requireControl(group: FormGroup, name: string): AbstractControl {
  const control = group.get(name);
  if (control === null) {
    throw new Error(`No form control named "${name}". Controls: [${Object.keys(group.controls).join(', ')}]`);
  }
  return control;
}

/** The same, for the one place that wants a `FormArray` rather than any control. */
export function requireFormArray(group: FormGroup, name: string): FormArray {
  const control = requireControl(group, name);
  if (!(control instanceof FormArray)) {
    throw new Error(`Form control "${name}" is not a FormArray`);
  }
  return control;
}
