import { Temporal } from '../models/temporal.model';
import { Xsd } from '../models/xsd.model';

/** The template settings that determine which temporal parts carry meaning. */
export interface CedarTemporalConfiguration {
  temporalType: string | null;
  granularity: string | null;
  timezoneEnabled: boolean;
}

/**
 * The editable parts of a CEDAR temporal value.
 *
 * Every part is a string deliberately. A JavaScript `Date` cannot represent an
 * incomplete year or month, and converting fractional seconds to a number loses
 * significant zeroes (`.001` becomes `.1`). Calendar libraries can still be used
 * at the date-picker boundary, but the value CEE stores is assembled here.
 */
export interface CedarTemporalParts {
  year: string | null;
  month: string | null;
  day: string | null;
  hour: string | null;
  minute: string | null;
  second: string | null;
  fraction: string | null;
  offset: string | null;
}

/**
 * Parse, normalize and serialize the lexical values used by CEDAR temporal
 * fields.
 *
 * Granularity is authoritative. Information finer than the configured
 * granularity is discarded and required hidden parts are padded with their
 * neutral value:
 *
 * - a year-granularity date stores `YYYY-01-01`;
 * - a day-granularity dateTime stores `YYYY-MM-DDT00:00:00`;
 * - a minute-granularity time stores `HH:mm:00`.
 *
 * This makes every emitted value a complete lexical `xsd:date`, `xsd:time` or
 * `xsd:dateTime`, while the UI only asks for the precision the template names.
 */
export class CedarTemporalValue {
  private static readonly DATE = /^(\d{4})-(\d{2})-(\d{2})(Z|[+-]\d{2}:\d{2})?$/;
  private static readonly TIME = /^(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/;
  private static readonly DATE_TIME =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/;

  static empty(): CedarTemporalParts {
    return {
      year: null,
      month: null,
      day: null,
      hour: null,
      minute: null,
      second: null,
      fraction: null,
      offset: null,
    };
  }

  /** Parse a stored value without repairing a malformed lexical form. */
  static parse(value: string, configuration: CedarTemporalConfiguration): CedarTemporalParts | null {
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }

    const parts = this.empty();
    if (configuration.temporalType === Xsd.date) {
      const match = value.match(this.DATE);
      if (match === null) {
        return null;
      }
      [, parts.year, parts.month, parts.day, parts.offset] = match;
    } else if (configuration.temporalType === Xsd.time) {
      const match = value.match(this.TIME);
      if (match === null) {
        return null;
      }
      [, parts.hour, parts.minute, parts.second, parts.fraction, parts.offset] = match;
    } else if (configuration.temporalType === Xsd.dateTime) {
      const match = value.match(this.DATE_TIME);
      if (match === null) {
        return null;
      }
      [, parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second, parts.fraction, parts.offset] =
        match;
    } else {
      return null;
    }

    return this.normalize(parts, configuration);
  }

  /**
   * Apply the template's precision to a set of parts.
   *
   * The returned object is new; callers can safely retain their editable draft.
   */
  static normalize(source: CedarTemporalParts, configuration: CedarTemporalConfiguration): CedarTemporalParts {
    const parts: CedarTemporalParts = { ...source };
    const granularity = configuration.granularity;

    if (configuration.temporalType === Xsd.date) {
      this.removeTime(parts);
      if (granularity === Temporal.year) {
        parts.month = '01';
        parts.day = '01';
      } else if (granularity === Temporal.month) {
        parts.day = '01';
      }
    } else if (configuration.temporalType === Xsd.time) {
      this.removeDate(parts);
      this.normalizeTime(parts, granularity);
    } else if (configuration.temporalType === Xsd.dateTime) {
      if (granularity === Temporal.year) {
        parts.month = '01';
        parts.day = '01';
        this.zeroTime(parts);
      } else if (granularity === Temporal.month) {
        parts.day = '01';
        this.zeroTime(parts);
      } else if (granularity === Temporal.day) {
        this.zeroTime(parts);
      } else {
        this.normalizeTime(parts, granularity);
      }
    }

    if (!configuration.timezoneEnabled) {
      parts.offset = null;
    }
    return parts;
  }

  /** Serialize a complete draft, or return null while required visible parts are absent. */
  static serialize(source: CedarTemporalParts, configuration: CedarTemporalConfiguration): string | null {
    const parts = this.normalize(source, configuration);
    if (!this.isComplete(parts, configuration)) {
      return null;
    }

    const date = `${this.year(parts.year)}-${this.two(parts.month)}-${this.two(parts.day)}`;
    const fraction = configuration.granularity === Temporal.decimalSecond ? `.${parts.fraction}` : '';
    const time = `${this.two(parts.hour)}:${this.two(parts.minute)}:${this.two(parts.second)}${fraction}`;
    const offset = parts.offset ?? '';

    if (configuration.temporalType === Xsd.date) {
      return date + offset;
    }
    if (configuration.temporalType === Xsd.time) {
      return time + offset;
    }
    if (configuration.temporalType === Xsd.dateTime) {
      return `${date}T${time}${offset}`;
    }
    return null;
  }

  /** Whether every part the user is expected to supply is present. */
  static isComplete(parts: CedarTemporalParts, configuration: CedarTemporalConfiguration): boolean {
    const granularity = configuration.granularity;
    const has = (...values: Array<string | null>): boolean => values.every((value) => value != null && value !== '');

    if (configuration.temporalType === Xsd.date) {
      if (granularity === Temporal.year) {
        return has(parts.year);
      }
      if (granularity === Temporal.month) {
        return has(parts.year, parts.month);
      }
      if (granularity === Temporal.day) {
        return has(parts.year, parts.month, parts.day);
      }
      return false;
    }

    const timeComplete = (): boolean => {
      if (granularity === Temporal.hour) {
        return has(parts.hour);
      }
      if (granularity === Temporal.minute) {
        return has(parts.hour, parts.minute);
      }
      if (granularity === Temporal.second) {
        return has(parts.hour, parts.minute, parts.second);
      }
      if (granularity === Temporal.decimalSecond) {
        return has(parts.hour, parts.minute, parts.second, parts.fraction);
      }
      return false;
    };

    if (configuration.temporalType === Xsd.time) {
      return timeComplete();
    }
    if (configuration.temporalType === Xsd.dateTime) {
      if (granularity === Temporal.year) {
        return has(parts.year);
      }
      if (granularity === Temporal.month) {
        return has(parts.year, parts.month);
      }
      if (granularity === Temporal.day) {
        return has(parts.year, parts.month, parts.day);
      }
      return has(parts.year, parts.month, parts.day) && timeComplete();
    }
    return false;
  }

  private static normalizeTime(parts: CedarTemporalParts, granularity: string | null): void {
    if (granularity === Temporal.hour) {
      parts.minute = '00';
      parts.second = '00';
      parts.fraction = null;
    } else if (granularity === Temporal.minute) {
      parts.second = '00';
      parts.fraction = null;
    } else if (granularity === Temporal.second) {
      parts.fraction = null;
    }
  }

  private static zeroTime(parts: CedarTemporalParts): void {
    parts.hour = '00';
    parts.minute = '00';
    parts.second = '00';
    parts.fraction = null;
  }

  private static removeDate(parts: CedarTemporalParts): void {
    parts.year = null;
    parts.month = null;
    parts.day = null;
  }

  private static removeTime(parts: CedarTemporalParts): void {
    parts.hour = null;
    parts.minute = null;
    parts.second = null;
    parts.fraction = null;
  }

  private static year(value: string | null): string {
    return (value ?? '').padStart(4, '0');
  }

  private static two(value: string | null): string {
    return (value ?? '').padStart(2, '0');
  }
}
