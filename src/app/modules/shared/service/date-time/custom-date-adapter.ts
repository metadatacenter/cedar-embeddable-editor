import { Injectable, OnDestroy } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DateTimeService } from './date-time.service';

/** The three granularities a date box shows, as `DateTimeService.format` identifies them. */
const YEAR = 'YYYY';
const YEAR_MONTH = 'MM/YYYY';

/**
 * How one language writes a date at each granularity, and how to read that form back.
 *
 * Each `parse` pattern matches exactly what the corresponding writer produces, with the leading zeros
 * and the Hungarian spacing made optional, so a date typed the way it is displayed is accepted.
 */
interface DateNotation {
  readonly day: (year: string, month: string, day: string) => string;
  readonly month: (year: string, month: string) => string;
  readonly year: (year: string) => string;
  /** Each returns the year, month and day it read, or null when the text is not in this form. */
  readonly parseDay: (text: string) => [number, number, number] | null;
  readonly parseMonth: (text: string) => [number, number] | null;
  readonly parseYear: (text: string) => number | null;
}

const numbers = (match: RegExpExecArray | null): number[] | null =>
  match === null ? null : match.slice(1).map((part) => Number(part));

/** The United States convention, which CEE has always displayed: 09/25/2026, 09/2026, 2026. */
const ENGLISH: DateNotation = {
  day: (year, month, day) => `${month}/${day}/${year}`,
  month: (year, month) => `${month}/${year}`,
  year: (year) => year,
  parseDay: (text) => {
    const parts = numbers(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/.exec(text));
    return parts === null ? null : [parts[2], parts[0], parts[1]];
  },
  parseMonth: (text) => {
    const parts = numbers(/^(\d{1,2})\/(\d{1,4})$/.exec(text));
    return parts === null ? null : [parts[1], parts[0]];
  },
  parseYear: (text) => numbers(/^(\d{1,4})$/.exec(text))?.[0] ?? null,
};

/** The Hungarian convention: year first, each part closed by a period: 2026. 09. 25. */
const HUNGARIAN: DateNotation = {
  day: (year, month, day) => `${year}. ${month}. ${day}.`,
  month: (year, month) => `${year}. ${month}.`,
  year: (year) => `${year}.`,
  parseDay: (text) => {
    const parts = numbers(/^(\d{1,4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/.exec(text));
    return parts === null ? null : [parts[0], parts[1], parts[2]];
  },
  parseMonth: (text) => {
    const parts = numbers(/^(\d{1,4})\.\s*(\d{1,2})\.?$/.exec(text));
    return parts === null ? null : [parts[0], parts[1]];
  },
  parseYear: (text) => numbers(/^(\d{1,4})\.?$/.exec(text))?.[0] ?? null,
};

/**
 * The date picker's adapter: it writes and reads the box's text in the configured language.
 *
 * The stored value is unaffected. The picker hands the field a `Date`, and the field writes it as an
 * ISO `xsd:date`; only the text in the box follows the language. English keeps the notation CEE has
 * always shown, and any language without a notation of its own uses it too.
 */
@Injectable()
export class CustomDateAdapter extends NativeDateAdapter implements OnDestroy {
  private readonly languageChanges: Subscription;

  constructor(
    private readonly dateTimeService: DateTimeService,
    private readonly translate: TranslateService,
  ) {
    super();
    // The datepicker input reformats its value when the adapter reports a locale change, so a
    // language chosen after the box was drawn still rewrites the date in the new notation.
    this.languageChanges = this.translate.onLangChange.subscribe(() => this._localeChanges.next());
  }

  ngOnDestroy(): void {
    this.languageChanges.unsubscribe();
  }

  public override format(date: Date, _displayFormat: object): string {
    if (!this.isValid(date)) {
      throw Error('CustomDateAdapter: Cannot format invalid date.');
    }
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const notation = this.notation();

    if (this.dateTimeService.format === YEAR) {
      return notation.year(year);
    }
    if (this.dateTimeService.format === YEAR_MONTH) {
      return notation.month(year, month);
    }
    return notation.day(year, month, day);
  }

  /**
   * Read the box's text in the notation `format` writes, and anything else as the native adapter does.
   *
   * A month or a year alone is read as its first day. Text in the right form that names no real date,
   * such as 02/30/2026, is an invalid date rather than one rolled over into the next month.
   */
  public override parse(value: unknown, parseFormat: unknown): Date | null {
    if (typeof value === 'string') {
      const parsed = this.parseDisplayed(value.trim());
      if (parsed !== null) {
        return parsed;
      }
    }
    return super.parse(value, parseFormat);
  }

  private parseDisplayed(text: string): Date | null {
    const notation = this.notation();
    if (this.dateTimeService.format === YEAR) {
      const year = notation.parseYear(text);
      return year === null ? null : this.localDate(year, 1, 1);
    }
    if (this.dateTimeService.format === YEAR_MONTH) {
      const parts = notation.parseMonth(text);
      return parts === null ? null : this.localDate(parts[0], parts[1], 1);
    }
    const parts = notation.parseDay(text);
    return parts === null ? null : this.localDate(parts[0], parts[1], parts[2]);
  }

  /** Midnight local time on a calendar date, with a one-based month. */
  private localDate(year: number, month: number, day: number): Date {
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    // `setFullYear`, because the `Date` constructor maps a year below 100 into the 1900s.
    date.setFullYear(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return this.invalid();
    }
    return date;
  }

  /** The notation for the configured language, matched on its primary subtag (`hu`, `hu-HU`). */
  private notation(): DateNotation {
    const language = (this.translate.getCurrentLang() ?? '').toLowerCase().split(/[-_]/)[0];
    return language === 'hu' ? HUNGARIAN : ENGLISH;
  }
}
