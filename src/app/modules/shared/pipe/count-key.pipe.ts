import { Pipe, PipeTransform } from '@angular/core';
import { countKey } from '../util/count-key';

/**
 * A counted message's key for `count`, for the `translate` pipe to render:
 * `{{ 'Validation.Text.MinLength' | ceeCountKey: min | translate: { constraintMinLength: min } }}`.
 */
@Pipe({ name: 'ceeCountKey', standalone: false })
export class CountKeyPipe implements PipeTransform {
  /** An absent count takes the plural form, the one that reads for any number. */
  transform(key: string, count: number | null): string {
    return countKey(key, count ?? 0);
  }
}
