import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CedarComponent } from '../models/component/cedar-component.model';
import { FieldComponent } from '../models/component/field-component.model';
import {
  specDefaultFactsOf,
  specKeywordOf,
  specOptionsOf,
  specUnitFactsOf,
  specValueFactsOf,
} from '../util/field-spec';

/**
 * Plain-text specification facts for the controlled-term widget's read-only note.
 * Read-only inputs themselves have no placeholders; constraints belong in the specification
 * presentation. This formatter retains its pipe name for the existing template consumer.
 * It is impure so changing the display language also translates the facts.
 */
@Pipe({ name: 'ceeSpecPlaceholder', standalone: false, pure: false })
export class SpecPlaceholderPipe implements PipeTransform {
  constructor(private readonly translate: TranslateService) {}

  transform(component: CedarComponent | null): string {
    const field = component as FieldComponent | null;
    if (field?.basicInfo?.inputType == null) {
      return '';
    }

    // A fact's lead-in word is a separate key so the rendered surfaces can italicize it; plain text
    // cannot, so here the two are simply joined back into the phrase they make.
    const parts = [...specValueFactsOf(field), ...specDefaultFactsOf(field), ...specUnitFactsOf(field)].map((fact) => {
      const value = this.translate.instant(fact.key, fact.params);
      const keyword = specKeywordOf(fact);
      return keyword === null ? value : `${this.translate.instant(keyword)} ${value}`;
    });

    const options = specOptionsOf(field);
    if (options.length > 0) {
      // Plain labels. Which one is the default is stated as its own fact ahead of this, so marking it
      // here as well would be the same fact twice — and in the harder-to-read place.
      const shown = options.map((option) => option.label);
      parts.push(`${this.translate.instant('Spec.PermittedValues')} ${shown.join(' · ')}`);
    }

    return parts.join(' · ');
  }
}
