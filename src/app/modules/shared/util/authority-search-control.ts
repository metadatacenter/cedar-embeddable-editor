import { AbstractControl } from '@angular/forms';

/**
 * What to do with a search box when the user leaves it.
 *
 * The external authority widgets — ORCID, ROR, PFAS, PubMed, RRID, NIH Grant,
 * DOI — are search boxes over an authority. The control holds whatever is being
 * typed; a value only exists once a term is picked from the autocomplete, and
 * only the pick reaches the model. So text left behind in the box on blur names
 * nothing, and cannot be saved.
 *
 * Six of the seven widgets left it there. The field then showed text the
 * instance did not contain — worse than an empty field, because it looks filled
 * and reads back blank. ORCID was the only one that reconciled on blur, and the
 * five simplest widgets had never had a blur handler at all; their `mat-error`
 * markup for "not a valid X and has been cleared" was decoration over a code
 * path that did not exist.
 *
 * The rule is here rather than in each component because those six are copies
 * of each other and had already drifted: ROR carried the revert machinery but
 * never bound it to anything, so it was dead in a different way.
 */
export type BlurOutcome = 'unchanged' | 'reverted' | 'cleared';

export class AuthoritySearchControl {
  /**
   * Reconcile the box with the value behind it.
   *
   * - `unchanged` — the text is the selected term's display text, or the box is
   *   empty and nothing was selected. Nothing to do.
   * - `reverted` — the text was edited away from a term that is still selected,
   *   so the term's display text is restored. The edit named nothing; the value
   *   is untouched.
   * - `cleared` — text with no term behind it. Removed, and `errorKey` set so
   *   the widget's existing message explains why the box emptied itself.
   *
   * @param selectedDisplay what the box reads when the selected term is shown,
   *                        or `''`/null when no term is selected.
   */
  static reconcileOnBlur(control: AbstractControl, selectedDisplay: string | null, errorKey: string): BlurOutcome {
    const typed = (control.value ?? '').toString().trim();
    const selected = (selectedDisplay ?? '').trim();

    if (typed === selected) {
      return 'unchanged';
    }
    if (selected) {
      // A term is still selected; the half-typed edit over the top of it goes.
      control.setValue(selectedDisplay, { emitEvent: false });
      return 'reverted';
    }
    if (!typed) {
      return 'unchanged';
    }
    control.setValue('', { emitEvent: true });
    control.setErrors({ [errorKey]: true });
    control.markAsTouched();
    return 'cleared';
  }
}
