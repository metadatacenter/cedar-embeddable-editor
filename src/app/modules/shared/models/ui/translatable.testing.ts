import en from '../../../../../assets/i18n-cee/en.json';
import hu from '../../../../../assets/i18n-cee/hu.json';
import { Translatable } from './translatable.model';

const BUNDLES: Record<'en' | 'hu', unknown> = { en, hu };

/**
 * What a user reads for a `Translatable`, in one of the two shipped languages.
 *
 * Specs use this to assert on the sentence a form shows rather than on its key alone. The lookup and
 * the `{{name}}` substitution follow the language files the way the `translate` pipe does, and a
 * missing key fails the spec instead of rendering the key itself.
 */
export const readTranslatable = (text: Translatable | null, lang: 'en' | 'hu' = 'en'): string => {
  if (text === null) {
    return '';
  }
  let node: unknown = BUNDLES[lang];
  for (const part of text.key.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  if (typeof node !== 'string') {
    throw new Error(`${lang}.json has no ${text.key}`);
  }
  return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(text.params?.[name] ?? `{{${name}}}`));
};
