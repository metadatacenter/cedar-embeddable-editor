import { Injector, runInInjectionContext } from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { CustomDateAdapter } from './custom-date-adapter';
import { DateTimeService } from './date-time.service';

/**
 * The date box writes its text in the configured language and reads that text back.
 *
 * English is pinned to the exact strings CEE has always shown, because the visual baselines contain
 * them. Hungarian writes the year first and closes each part with a period.
 */
describe('CustomDateAdapter', () => {
  const make = (language: string | null, format: string) => {
    const onLangChange = new Subject<void>();
    let current = language;
    const translate = {
      getCurrentLang: () => current,
      onLangChange,
    } as unknown as TranslateService;
    const dateTimeService = new DateTimeService();
    dateTimeService.format = format;
    const injector = Injector.create({ providers: [{ provide: MAT_DATE_LOCALE, useValue: 'en-US' }] });
    const adapter = runInInjectionContext(injector, () => new CustomDateAdapter(dateTimeService, translate));
    const switchTo = (next: string): void => {
      current = next;
      onLangChange.next();
    };
    return { adapter, switchTo };
  };
  const date = new Date(2026, 8, 5);
  const ymd = (value: Date | null): [number, number, number] | null =>
    value === null ? null : [value.getFullYear(), value.getMonth() + 1, value.getDate()];

  describe.each([
    ['en', 'MM/DD/YYYY', '09/05/2026', [2026, 9, 5]],
    ['en', 'MM/YYYY', '09/2026', [2026, 9, 1]],
    ['en', 'YYYY', '2026', [2026, 1, 1]],
    ['hu', 'MM/DD/YYYY', '2026. 09. 05.', [2026, 9, 5]],
    ['hu', 'MM/YYYY', '2026. 09.', [2026, 9, 1]],
    ['hu', 'YYYY', '2026.', [2026, 1, 1]],
  ])('in %s at granularity %s', (language, format, shown, read) => {
    it(`displays ${shown}`, () => {
      expect(make(language, format).adapter.format(date, {})).toBe(shown);
    });

    it('reads back what it displays', () => {
      const { adapter } = make(language, format);
      expect(ymd(adapter.parse(adapter.format(date, {}), {}))).toEqual(read);
    });
  });

  it('reads Hungarian dates typed without leading zeros or spaces', () => {
    const { adapter } = make('hu', 'MM/DD/YYYY');
    expect(ymd(adapter.parse('2026.9.5', {}))).toEqual([2026, 9, 5]);
    expect(ymd(adapter.parse(' 2026. 9. 5. ', {}))).toEqual([2026, 9, 5]);
  });

  it('refuses a date in the right form that does not exist, rather than rolling it over', () => {
    const { adapter } = make('en', 'MM/DD/YYYY');
    const parsed = adapter.parse('02/30/2026', {});
    expect(parsed).not.toBeNull();
    expect(adapter.isValid(parsed as Date)).toBe(false);
  });

  it('keeps a year below 100 in its own century', () => {
    const { adapter } = make('hu', 'YYYY');
    expect(adapter.format(adapter.parse('0042.', {}) as Date, {})).toBe('0042.');
  });

  it('uses the English notation for a language without one, and for a regional Hungarian tag the Hungarian one', () => {
    expect(make('de', 'MM/DD/YYYY').adapter.format(date, {})).toBe('09/05/2026');
    expect(make(null, 'MM/DD/YYYY').adapter.format(date, {})).toBe('09/05/2026');
    expect(make('hu-HU', 'MM/DD/YYYY').adapter.format(date, {})).toBe('2026. 09. 05.');
  });

  it('announces a language change, so the box redraws its date in the new notation', () => {
    const { adapter, switchTo } = make('en', 'MM/DD/YYYY');
    const redraws = vi.fn();
    adapter.localeChanges.subscribe(redraws);
    switchTo('hu');
    expect(redraws).toHaveBeenCalledTimes(1);
    expect(adapter.format(date, {})).toBe('2026. 09. 05.');
    adapter.ngOnDestroy();
    switchTo('en');
    expect(redraws).toHaveBeenCalledTimes(1);
  });

  it('leaves text in no displayed form to the native parser', () => {
    const { adapter } = make('hu', 'MM/DD/YYYY');
    expect(ymd(adapter.parse('2026-09-05T00:00:00', {}))).toEqual([2026, 9, 5]);
    expect(adapter.parse('', {})).toBeNull();
  });
});
