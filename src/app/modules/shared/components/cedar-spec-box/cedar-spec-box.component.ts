import { ChangeDetectionStrategy, Component, inject, Input, ViewEncapsulation } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { languageTag, textLanguageOf, uiLanguageOf } from '../../a11y/language-tag';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';
import { FieldComponent } from '../../models/component/field-component.model';
import { ResourceDescriptionService } from '../../service/resource-description.service';
import {
  SpecDefaultTerm,
  SpecFact,
  SpecFactKey,
  SpecTermSource,
  specDefaultFactsOf,
  specDefaultIsText,
  specDefaultTermOf,
  specOptionsOf,
  specKeywordOf,
  specTermSourcesOf,
  specUnitFactsOf,
  specValueFactsOf,
} from '../../util/field-spec';

/**
 * The box a field shows when it is read and holds nothing: the same rectangle a control draws, saying
 * what a value must be instead of holding one.
 *
 * It replaces the control rather than dressing it, for two reasons a placeholder cannot meet. A
 * placeholder is one line, so a pattern beside a count and a unit is truncated at any narrow width,
 * and this wraps. And a placeholder is text, so an ontology cannot be a link, where here each
 * authority is one, pointing at its own BioPortal page.
 *
 * Only where there is nothing to hold. A radio or checkbox group draws its own options and an
 * attribute-value pair names its two halves, so those keep their controls and state their facts
 * beside the field's name; an instance keeps every control, because then the box has a value to show.
 */
@Component({
  selector: 'app-cedar-spec-box',
  templateUrl: './cedar-spec-box.component.html',
  styleUrls: ['./cedar-spec-box.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarSpecBoxComponent {
  private readonly resources = inject(ResourceDescriptionService, { optional: true });
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly globalSettings = inject(GlobalSettingsContextService, { optional: true });

  @Input({ required: true }) fieldToDescribe!: FieldComponent;

  /** Value-shape facts, kept structured so their lead-in words can be styled independently. */
  get facts(): ReadonlyArray<SpecFact> {
    return [
      ...specValueFactsOf(this.fieldToDescribe),
      ...specDefaultFactsOf(this.fieldToDescribe),
      ...specUnitFactsOf(this.fieldToDescribe),
    ];
  }

  /** The lead-in word this fact is stated with, or null where it leads with none. */
  keywordOf(fact: SpecFact): string | null {
    return specKeywordOf(fact);
  }

  /** The option labels a closed list control would otherwise conceal. */
  get optionLabels(): string {
    return specOptionsOf(this.fieldToDescribe)
      .map((option) => option.label)
      .join(' · ');
  }

  /**
   * The language of the option labels, which are the field's values and the template's text: the
   * language the field declares for its values, and otherwise the language of the template's text.
   */
  get optionLanguage(): string | null {
    return languageTag(this.fieldToDescribe.basicInfo.valueLanguage) ?? textLanguageOf(this.fieldToDescribe);
  }

  /**
   * The `lang` the lead-in word takes inside the marked options: CEE's language where the options
   * have a language of their own, and none otherwise, since it then takes CEE's language from the root.
   */
  get uiLanguageMark(): string | null {
    return this.optionLanguage === null || this.translate === null || this.globalSettings === null
      ? null
      : uiLanguageOf(this.translate, this.globalSettings);
  }

  /**
   * The `lang` a fact is marked with. A default the template wrote as text is a value of the field,
   * in the language of its values and otherwise of the template's text, as the options are. A unit of
   * measure is the template's text, in the language it declares for it. Every other fact is CEE's
   * text and takes CEE's language from the root.
   */
  languageOf(fact: SpecFact): string | null {
    if (fact.key === SpecFactKey.unitOfMeasure) {
      return textLanguageOf(this.fieldToDescribe);
    }
    return fact.key === SpecFactKey.defaultValue && specDefaultIsText(this.fieldToDescribe)
      ? this.optionLanguage
      : null;
  }

  /** The `lang` a fact's lead-in word takes: CEE's language inside a fact marked with another. */
  keywordLanguageOf(fact: SpecFact): string | null {
    return this.languageOf(fact) === null ? null : this.uiLanguageMark;
  }

  /** The declared default when it is a term, which can be linked, rather than text, which cannot. */
  get defaultTerm(): SpecDefaultTerm | null {
    return specDefaultTermOf(this.fieldToDescribe);
  }

  /** The default's ontology acronym, unless its label already ends with it in parentheses. */
  get defaultTermAcronym(): string | null {
    const term = this.defaultTerm;
    return term?.acronym && !term.label.includes('(' + term.acronym + ')') ? term.acronym : null;
  }

  /** Where that term can be read about, built the way the field's own value link is. */
  get defaultTermLink(): string | null {
    const term = this.defaultTerm;
    return term === null
      ? null
      : (this.resources?.termLink(this.fieldToDescribe.controlledInfo, term.uri)?.landingPage ?? null);
  }

  get termSources(): ReadonlyArray<SpecTermSource> {
    return specTermSourcesOf(this.fieldToDescribe);
  }

  /** Where the authority can be read about, or null when no public destination is known. */
  linkFor(source: SpecTermSource): string | null {
    return this.resources?.sourceLink(source) ?? null;
  }
}
