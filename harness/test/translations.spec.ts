/**
 * The translation files, as data.
 *
 * CEE ships two language maps and picks between them with `defaultLanguage` /
 * `fallbackLanguage`. Nothing checked they described the same set of strings, and
 * they had drifted badly: 85 keys in `en.json` against 60 in `hu.json`, with every
 * external-authority string missing from Hungarian — all seven `Generic.Filter*`
 * placeholders and all fourteen `Validation.*Invalid` / `*Reverted` messages.
 *
 * The way it drifted is the interesting part. `hu.json` carried a key named
 * `Generic.Szűrés`, whose value was `Kezdjen el írni a szűréshez` — the Hungarian
 * for `Generic.Filter`'s English. Someone translated the **key** along with the
 * value, so `Generic.Filter` was missing and a key nothing would ever look up sat
 * in its place. A Hungarian user saw a raw key where a placeholder should be, and
 * no test could tell.
 *
 * These assertions are cheap and would have caught both the day they happened.
 * They are deliberately structural rather than linguistic — a test cannot know
 * whether a translation is *good*, but it can know that one exists, is not the
 * English verbatim, and is not an accidentally-translated key.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const I18N = path.resolve(__dirname, '../../src/assets/i18n-cee');
const LANGUAGES = ['en', 'hu'] as const;
const REFERENCE = 'en';

type Flat = Record<string, string>;

const load = (lang: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(I18N, `${lang}.json`), 'utf8'));

const flatten = (node: Record<string, unknown>, prefix = ''): Flat => {
  const out: Flat = {};
  for (const [key, value] of Object.entries(node)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, `${prefix}${key}.`));
    } else {
      out[`${prefix}${key}`] = String(value);
    }
  }
  return out;
};

const maps = Object.fromEntries(LANGUAGES.map((l) => [l, flatten(load(l))])) as Record<string, Flat>;
const reference = maps[REFERENCE];

describe('the translation files', () => {
  it('all exist and are non-empty', () => {
    for (const lang of LANGUAGES) {
      expect(Object.keys(maps[lang]).length, `${lang}.json is empty`).toBeGreaterThan(0);
    }
  });

  it.each(LANGUAGES.filter((l) => l !== REFERENCE))('%s declares exactly the keys en declares', (lang) => {
    const missing = Object.keys(reference).filter((k) => !(k in maps[lang]));
    const extra = Object.keys(maps[lang]).filter((k) => !(k in reference));

    // Named rather than counted, so a failure says which string a user will not see.
    expect(missing, `${lang}.json is missing keys, so those strings fall back or show raw`).toEqual([]);
    expect(extra, `${lang}.json has keys en does not — usually a translated key name`).toEqual([]);
  });

  /**
   * A key that looks translated is the specific failure that happened here, and it
   * is invisible to a parity check on its own: the file stays the same size and the
   * key merely stops matching. Non-ASCII in a key is the signal — every key in this
   * project is ASCII, and a translator reaching for `Szűrés` produced exactly this.
   */
  it.each(LANGUAGES)('%s uses ASCII key names, whatever language the values are in', (lang) => {
    const nonAscii = Object.keys(maps[lang]).filter((k) => !/^[\x20-\x7e]+$/.test(k));
    expect(nonAscii, 'keys are identifiers and must not be translated').toEqual([]);
  });

  it.each(LANGUAGES)('%s has no blank values', (lang) => {
    const blank = Object.entries(maps[lang])
      .filter(([, v]) => v.trim() === '')
      .map(([k]) => k);
    expect(blank).toEqual([]);
  });

  /**
   * Untranslated strings, reported rather than asserted away.
   *
   * A value identical to the English is usually an oversight, but not always —
   * `ORCID`, `DOI` and `SAVE`-style tokens are the same in both, and forcing them to
   * differ would be worse than leaving them. So this fails only if a *long* value is
   * byte-identical, which is a sentence someone forgot rather than a shared acronym.
   */
  it.each(LANGUAGES.filter((l) => l !== REFERENCE))('%s translates its sentences', (lang) => {
    const untranslated = Object.entries(maps[lang])
      .filter(([k, v]) => v.length > 25 && v === reference[k])
      .map(([k]) => k);
    expect(untranslated, 'a full sentence identical to the English is an untranslated string').toEqual([]);
  });

  /**
   * The authority strings specifically, because they are what went missing and they
   * are the ones a user meets while typing into a field that then rejects the value.
   */
  it.each(LANGUAGES)('%s covers every external authority', (lang) => {
    const authorities = ['Orcid', 'Ror', 'Pfas', 'Pmid', 'Rrid', 'NihGrant', 'Doi'];
    for (const authority of authorities) {
      for (const key of [
        `Generic.Filter${authority}`,
        `Validation.${authority}Invalid`,
        `Validation.${authority}Reverted`,
      ]) {
        expect(maps[lang][key], `${lang} is missing ${key}`).toBeTruthy();
      }
    }
  });
});
