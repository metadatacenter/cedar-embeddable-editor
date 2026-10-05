/**
 * Every CEE message that carries a count, at zero, one and two, in English and Hungarian.
 *
 * A number before a noun needs a singular in English: "Value should be at least 1 chars long" and
 * "At least 1 entries are required" were what one meant. A counted message keeps its singular under
 * its key with `One` appended, and `countKey`, with the `ceeCountKey` pipe over it, is the one place
 * that chooses. Hungarian keeps a noun singular after any number, so its two texts read alike. This
 * fails when a message counting a plural noun has no singular, when a singular still reads as a
 * plural, or when source names a singular itself rather than asking `countKey`.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { countKey } from '../../src/app/modules/shared/util/count-key';

const ROOT = path.resolve(__dirname, '../..');
type Tree = { [key: string]: string | Tree };
const read = (language: string): Tree =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'src/assets/i18n-cee', `${language}.json`), 'utf8'));
function flatten(node: Tree, prefix = '', into: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') into[full] = value;
    else flatten(value, full, into);
  }
  return into;
}
const TEXTS = { en: flatten(read('en')), hu: flatten(read('hu')) };

// The parameters these messages count with, as opposed to names, values and formats.
const COUNTS =
  /\{\{\s*(count|min|max|minLength|maxLength|constraintMinLength|constraintMaxLength|decimalPlace)\s*\}\}([^.,:;()—–|]*)/g;
const NOT_PLURAL = new Set(['is', 'was', 'has', 'its', 'this', 'as']);
const readsPlural = (text: string): boolean =>
  [...text.matchAll(COUNTS)].some((match) =>
    match[2]
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .some((word) => /s$/i.test(word) && !NOT_PLURAL.has(word.toLowerCase())),
  );
const COUNTED = Object.keys(TEXTS.en).filter((key) => TEXTS.en[`${key}One`] !== undefined);

describe('counted messages', () => {
  it('give every English message that counts a plural noun a singular, in both languages', () => {
    const missing = Object.entries(TEXTS.en)
      .filter(([key, text]) => !key.endsWith('One') && readsPlural(text))
      .filter(([key]) => TEXTS.en[`${key}One`] === undefined || TEXTS.hu[`${key}One`] === undefined)
      .map(([key, text]) => `${key}: ${text}`);
    expect(missing).toEqual([]);
  });

  for (const key of COUNTED)
    for (const language of ['en', 'hu'] as const)
      for (const count of [0, 1, 2])
        it(`render ${key} with ${count}, in ${language}`, () => {
          const text = TEXTS[language][countKey(key, count)];
          expect(typeof text).toBe('string');
          if (language === 'en' && count === 1) {
            expect(readsPlural(text), `the singular still reads as a plural: ${text}`).toBe(false);
            expect(text).not.toBe(TEXTS.en[key]);
          }
        });

  // A typed table may list a singular's key; what countKey replaces is a site choosing between the
  // two forms on a count of one.
  it('are chosen by countKey, never by a site comparing a count with one', () => {
    const offenders: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        // count-key.ts is the one place that does choose.
        else if (/\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') && entry.name !== 'count-key.ts') {
          const source = fs.readFileSync(full, 'utf8');
          source.split('\n').forEach((line, index) => {
            if (/===\s*1\s*\?/.test(line) && /One\b|One['"`]|Places?\b/.test(line))
              offenders.push(`${full}:${index + 1}`);
          });
        }
      }
    };
    walk(path.join(ROOT, 'src/app'));
    expect(offenders).toEqual([]);
  });
});
