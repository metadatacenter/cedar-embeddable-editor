import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { FieldSeverity } from '../a11y/field-severity';

/**
 * A widget's message, led by the word that marks it as a warning while its field shows only
 * warnings, so that amber is not all that tells it from an error (WCAG 1.4.1):
 * `{{ 'Validation.Email.Invalid' | translate | ceeWarned }}`.
 *
 * A message whose text already begins with the word, such as an unanswered requirement's, does not
 * take it, and neither do the report's notices, which mark their own. Impure, because the field's
 * state and the language can change while the message stays the same.
 */
@Pipe({ name: 'ceeWarned', pure: false, standalone: false })
export class WarnedPipe implements PipeTransform {
  // Optional, so a widget drawn without a presentation, as in a spec, says its message alone.
  private readonly severity = inject(FieldSeverity, { optional: true });
  private readonly translate = inject(TranslateService);

  transform(message: string): string {
    return message && this.severity?.warningOnly
      ? `${this.translate.instant('Validation.Warning')} ${message}`
      : message;
  }
}
