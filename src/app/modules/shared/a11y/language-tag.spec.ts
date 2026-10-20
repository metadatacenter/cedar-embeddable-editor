import { TranslateService } from '@ngx-translate/core';
import { GlobalSettingsContextService } from '../service/global-settings-context.service';
import { LabelInfo } from '../models/info/label-info.model';
import { languageTag, textLanguageOf, uiLanguageOf } from './language-tag';

describe('languageTag', () => {
  it('canonicalizes a tag and spells a map name as one', () => {
    expect(languageTag('hu')).toBe('hu');
    expect(languageTag('en-us')).toBe('en-US');
    expect(languageTag('hu_HU')).toBe('hu-HU');
  });

  it('asserts nothing for an absent or malformed tag', () => {
    expect(languageTag(null)).toBeNull();
    expect(languageTag(undefined)).toBeNull();
    expect(languageTag('  ')).toBeNull();
    expect(languageTag('not a tag')).toBeNull();
  });
});

describe('textLanguageOf', () => {
  const declaring = (language: string | null): { labelInfo: LabelInfo } => {
    const labelInfo = new LabelInfo();
    labelInfo.language = language;
    return { labelInfo };
  };

  it('reads the language declared for the text as a tag', () => {
    expect(textLanguageOf(declaring('fr'))).toBe('fr');
    expect(textLanguageOf(declaring('de_ch'))).toBe('de-CH');
  });

  it('asserts nothing where no language or a malformed one is declared', () => {
    expect(textLanguageOf(declaring(null))).toBeNull();
    expect(textLanguageOf(declaring('not a tag'))).toBeNull();
    expect(textLanguageOf(null)).toBeNull();
    expect(textLanguageOf({})).toBeNull();
  });
});

describe('uiLanguageOf', () => {
  const translateIn = (language: string | null): TranslateService =>
    ({ currentLang: () => language }) as unknown as TranslateService;

  it('names the language of the map in use rather than the one configured', () => {
    const globals = new GlobalSettingsContextService();
    globals.recordMapLanguage('fr', 'en');
    globals.recordMapLanguage('hu', 'hu');
    expect(uiLanguageOf(translateIn('fr'), globals)).toBe('en');
    expect(uiLanguageOf(translateIn('hu'), globals)).toBe('hu');
  });

  it('names a language whose map is not yet recorded as itself, and none before one is in use', () => {
    const globals = new GlobalSettingsContextService();
    expect(uiLanguageOf(translateIn('de'), globals)).toBe('de');
    expect(uiLanguageOf(translateIn(null), globals)).toBeNull();
  });
});
