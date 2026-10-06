/**
 * The sentence a form shows under each field whose stored value breaks one of the field's own
 * constraints, in each language CEE ships.
 *
 * The harness's problem-code matrix holds the report to every one of these codes: where it is
 * found, that it survives navigation and that a repair clears it. Which sentence reaches the user is
 * decided in the browser, and so is whether the Hungarian form says it in Hungarian, which no
 * browser test asked of a stored problem before.
 *
 * Two of the codes never reach a sentence. A date finer than its field's precision, and an offset on
 * a field that records none, are rewritten to the field's own form as the instance loads, which is
 * how the temporal widget treats every stored value. The rewritten value has nothing wrong with it,
 * so the form says nothing, and what it holds is checked instead.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open } from './support/host';
import type { CeeLocation } from '../../src/app/cee-public-api';

const FIXTURE = '27-stored-constraints';
const INSTANCE = '27-stored-constraints-instance';

/** The rendered field whose header carries this label. */
const component = (page: Page, label: string): Locator =>
  page
    .locator('app-cedar-component-renderer')
    .filter({ has: page.locator('app-cedar-component-header', { hasText: new RegExp(`^\\s*${label}\\b`) }) })
    .last();

/** What the form says about a field: an input's error, or a list's own problem line. */
const said = (page: Page, label: string): Locator => component(page, label).locator('mat-error, .cee-field-problem');

const reveal = (page: Page, location: CeeLocation): Promise<boolean> =>
  page.evaluate((where) => document.querySelector('cedar-embeddable-editor')!.reveal(where), location);

const MESSAGES: Record<'en' | 'hu', Array<[string, string]>> = {
  en: [
    ['pattern', 'Value does not match the required format.'],
    ['shorttext', 'Value should be at least 8 chars long.'],
    ['longtext', 'Value should be at most 5 chars long.'],
    ['shortnote', 'Value should be at least 8 chars long.'],
    ['longnote', 'Value should be at most 5 chars long.'],
    ['measure', 'The value should be a decimal with at most 2 decimal places.'],
    ['moment', 'The timezone offset is not a valid UTC offset. Choose one from the list.'],
    ['answer', '"Maybe" is not one of the options for this field.'],
    ['region', '"Elsewhere" is not one of the options for this field.'],
    ['organism', 'The stored term is missing its label or its IRI.'],
    ['tags', 'At most 1 entry is allowed.'],
    ['aliases', 'At least 3 entries are required.'],
  ],
  hu: [
    ['pattern', 'Az érték nem felel meg az előírt formátumnak.'],
    ['shorttext', 'Az érték legalább 8 karakter hosszú kell legyen.'],
    ['longtext', 'Az érték legfeljebb 5 karakter hosszú lehet.'],
    ['shortnote', 'Az érték legalább 8 karakter hosszú kell legyen.'],
    ['longnote', 'Az érték legfeljebb 5 karakter hosszú lehet.'],
    ['measure', 'Az értéknek legfeljebb 2 tizedesjegyű tizedes törtnek (decimal) kell lennie.'],
    ['moment', 'Az időzóna-eltolás nem érvényes UTC-eltolás. Válasszon egyet a listából.'],
    ['answer', '„Maybe” nem szerepel a mező választási lehetőségei között.'],
    ['region', '„Elsewhere” nem szerepel a mező választási lehetőségei között.'],
    ['organism', 'A tárolt kifejezésből hiányzik a címke vagy az IRI.'],
    ['tags', 'Legfeljebb 1 bejegyzés megengedett.'],
    ['aliases', 'Legalább 3 bejegyzés szükséges.'],
  ],
};

for (const language of ['en', 'hu'] as const) {
  test(`states each broken constraint at its field in ${language}`, async ({ page }) => {
    await open(page, FIXTURE, language === 'hu' ? 'hu' : undefined, INSTANCE);
    // A list short of its minimum is a warning, and like an unanswered requirement it waits until
    // the user is taken to it.
    expect(await reveal(page, { path: ['_aliases'] })).toBe(true);
    for (const [label, message] of MESSAGES[language]) {
      await expect(said(page, label), label).toHaveText([message]);
    }
  });
}

test('rewrites a date finer than its precision, and an offset its field does not record, and says nothing', async ({
  page,
}) => {
  await open(page, FIXTURE, undefined, INSTANCE);
  const held = (key: string) =>
    page.evaluate(
      (property) =>
        (document.querySelector('cedar-embeddable-editor')!.currentMetadata as Record<string, { '@value'?: string }>)[
          property
        ]?.['@value'],
      key,
    );
  await expect.poll(() => held('_year')).toBe('2026-01-01');
  await expect.poll(() => held('_day')).toBe('2026-08-01');
  for (const label of ['year', 'day']) {
    await expect(said(page, label), label).toHaveCount(0);
  }
});
