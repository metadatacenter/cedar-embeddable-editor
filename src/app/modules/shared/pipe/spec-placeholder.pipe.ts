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
 * What an empty control says about the value it would hold, for its placeholder.
 *
 * Read-only rendering shows the form as an author will meet it, so the controls stay — but an empty
 * box states nothing, and the placeholder slot is the one part of a control that is about the value
 * rather than about the widget. So it carries the specification: `xsd:double · min 0`, a pattern, the
 * permitted values, the ontology branch a term must come from.
 *
 * A temporal field composes this with its own notation, which it builds from the granularity: the
 * pipe supplies the clock and zone rules, while the widget supplies `YYYY-MM-DD`. A repeating
 * field's occurrence range stays beside its name, where it also works for elements.
 *
 * A controlled field's authorities are not here. They are links out to BioPortal, and placeholder
 * text cannot be clicked, so they are rendered beside the field's name instead.
 *
 * Joined here rather than in a template because a template cannot join translated strings, and each
 * fact is a key with parameters. `instant` rather than the `translate` pipe for the same reason; a
 * language switch after first render therefore needs the control to re-evaluate, which is why this
 * pipe is impure.
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
      parts.push(`${this.translate.instant('Spec.PermittedValues')} ${shown.join(', ')}`);
    }

    return parts.join(' · ');
  }
}
