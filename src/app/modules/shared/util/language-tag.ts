import { TranslateService } from '@ngx-translate/core';
import { GlobalSettingsContextService } from '../service/global-settings-context.service';

/**
 * A language as an HTML `lang` attribute takes it, or null where there is none to state.
 *
 * Configuration names a translation map, which a host may spell `hu_HU`, and an instance may
 * carry any string as `@language`. The attribute takes a BCP 47 tag, so underscores become
 * hyphens and a value that is not a well-formed tag is dropped rather than asserted.
 */
export function languageTag(value: string | null | undefined): string | null {
  const text = typeof value === 'string' ? value.trim().replace(/_/g, '-') : '';
  if (text === '') {
    return null;
  }
  try {
    return Intl.getCanonicalLocales(text)[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The language CEE's own text is in, or null before a language is in use.
 *
 * That is the language of the map in use, which is not always the one configured: a configured
 * language with no map of its own is shown from the English map, and marking that text with the
 * configured language would misname it. The map is recorded before the language comes into use,
 * so a reading taken when the language changes is current.
 */
export function uiLanguageOf(translate: TranslateService, globals: GlobalSettingsContextService): string | null {
  const current = translate.currentLang();
  return current === null ? null : languageTag(globals.mapLanguage(current));
}

/** Mark an element CEE renders outside its root, such as the overlay container, with that language. */
export function markLanguage(element: HTMLElement, language: string | null): void {
  if (language === null) {
    element.removeAttribute('lang');
  } else {
    element.setAttribute('lang', language);
  }
}
