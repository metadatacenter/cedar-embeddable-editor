import { FieldComponent } from '../models/component/field-component.model';
import { InputType } from '../models/input-type.model';
import { Numbers } from '../models/numbers.model';
import { Temporal } from '../models/temporal.model';
import { Xsd } from '../models/xsd.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { ValidationCode, ValidationProblem } from './validation-problem.model';
import { InstanceValueNode } from '../util/instance-value-node';
import { InstanceNode, isInstanceObject } from '../models/instance-node.model';

/**
 * Constraint checking for a single field value.
 *
 * Pure and framework-free: it takes a component and a plain value and returns
 * problems. That is deliberate — the widgets express the same constraints as
 * Angular validators, and the intent is that both eventually call this rather
 * than each holding its own opinion. Two of the defects found in this codebase
 * were exactly that: a second place deciding independently what the first had
 * already decided.
 *
 * Scope: everything checkable from the template plus the value. Controlled-term
 * *membership* is deliberately absent — it needs the terminology server, and a
 * report that silently skipped a network call would be worse than one that
 * never claimed to make it. Structural checks on controlled values are here.
 */
export class FieldValueValidator {
  /** Values that count as "nothing entered". */
  private static isEmpty(value: unknown): boolean {
    return value === null || value === undefined || value === '';
  }

  static validate(component: FieldComponent, value: unknown, path: string[]): ValidationProblem[] {
    // An absent value is the required check's business, handled by the report's
    // counters. Constraints describe what a value must look like *if present*.
    if (this.isEmpty(value)) {
      return [];
    }

    const problems: ValidationProblem[] = [];
    const inputType = component.basicInfo.inputType;
    const text = String(value);

    this.checkTextConstraints(component, text, path, problems);
    this.checkFormat(component, text, path, problems);

    if (inputType === InputType.numeric) {
      this.checkNumeric(component, text, path, problems);
    }
    if (inputType === InputType.temporal) {
      this.checkTemporal(component, text, path, problems);
    }
    if (component.choiceInfo?.choices?.length > 0) {
      this.checkChoiceMembership(component, text, path, problems);
    }

    return problems;
  }

  private static problem(
    component: FieldComponent,
    path: string[],
    code: string,
    message: string,
    value: unknown,
  ): ValidationProblem {
    return new ValidationProblem(
      path,
      path.length > 0 ? path[path.length - 1] : component.name,
      component.basicInfo.inputType,
      code,
      message,
      value,
    );
  }

  private static checkTextConstraints(
    component: FieldComponent,
    text: string,
    path: string[],
    out: ValidationProblem[],
  ): void {
    const vi = component.valueInfo;
    if (vi.minLength != null && text.length < vi.minLength) {
      out.push(
        this.problem(component, path, ValidationCode.minLength, `Shorter than the minimum ${vi.minLength}.`, text),
      );
    }
    if (vi.maxLength != null && text.length > vi.maxLength) {
      out.push(
        this.problem(component, path, ValidationCode.maxLength, `Longer than the maximum ${vi.maxLength}.`, text),
      );
    }
    if (vi.regex != null && vi.regex !== '') {
      let matches: boolean;
      try {
        // Anchored, matching how Angular's Validators.pattern behaves.
        matches = new RegExp(`^(?:${vi.regex})$`).test(text);
      } catch {
        // An unparseable regex is the template's problem, not the value's.
        return;
      }
      if (!matches) {
        out.push(this.problem(component, path, ValidationCode.regex, `Does not match ${vi.regex}.`, text));
      }
    }
  }

  private static readonly EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Link and phone patterns are taken verbatim from the widgets that owned
   * them, so moving the check here changes nothing about which values are
   * accepted. Both are looser than they look — the link one is unanchored,
   * matching how Angular applies a `RegExp` (only string patterns get wrapped
   * in `^...$`), so a URI embedded in surrounding text passes. Preserved rather
   * than tightened: that is a product call, not a refactor.
   */
  private static readonly LINK = /(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})[/\w .-]*\/?/i;
  private static readonly PHONE = /^[+0-9\s\-()]+$/im;

  /** Used only for external-authority fields, which store a bare IRI. */
  private static readonly IRI = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s]+$|^urn:[^\s]+$|^doi:[^\s]+$/;

  private static checkFormat(component: FieldComponent, text: string, path: string[], out: ValidationProblem[]): void {
    const inputType = component.basicInfo.inputType;

    if (inputType === InputType.email && !this.EMAIL.test(text)) {
      out.push(this.problem(component, path, ValidationCode.email, 'Not a valid email address.', text));
    }
    if (inputType === InputType.link && !this.LINK.test(text)) {
      out.push(this.problem(component, path, ValidationCode.link, 'Not a valid URI.', text));
    }
    if (inputType === InputType.phoneNumber && !this.PHONE.test(text)) {
      out.push(this.problem(component, path, ValidationCode.phoneNumber, 'Not a valid phone number.', text));
    }
    // External authority fields store an IRI. Membership in the authority is a
    // server question; well-formedness is not.
    if (inputType !== null && EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType as InputType) && !this.IRI.test(text)) {
      out.push(this.problem(component, path, ValidationCode.iriMalformed, 'Not a valid IRI.', text));
    }
  }

  /**
   * Integer-like types and the implicit bounds the XSD type itself imposes.
   *
   * BigInt, because xsd:long's range exceeds what a double represents exactly — see
   * Numbers. The comparison below must stay in BigInt for the same reason.
   */
  private static readonly INTEGRAL_BOUNDS: Record<string, [bigint, bigint]> = {
    [Xsd.int]: [Numbers.NUMBER_INT_MIN, Numbers.NUMBER_INT_MAX],
    [Xsd.long]: [Numbers.NUMBER_LONG_MIN, Numbers.NUMBER_LONG_MAX],
    [Xsd.byte]: [Numbers.NUMBER_BYTE_MIN, Numbers.NUMBER_BYTE_MAX],
    [Xsd.short]: [Numbers.NUMBER_SHORT_MIN, Numbers.NUMBER_SHORT_MAX],
  };

  private static checkNumeric(component: FieldComponent, text: string, path: string[], out: ValidationProblem[]): void {
    const ni = component.numberInfo;
    const numberType = ni.numberType;
    const integral = numberType != null && Object.prototype.hasOwnProperty.call(this.INTEGRAL_BOUNDS, numberType);
    const fractional = numberType === Xsd.float || numberType === Xsd.double || numberType === Xsd.decimal;

    if (integral && !new RegExp(`^${Numbers.PATTERN_XSD_INT_AND_LONG}$`).test(text)) {
      out.push(this.problem(component, path, ValidationCode.numberType, `Not a valid ${numberType}.`, text));
      return;
    }
    if (fractional) {
      const maxDig = ni.decimalPlace != null ? String(ni.decimalPlace) : '';
      const pattern = Numbers.PATTERN_XSD_FLOAT_AND_DOUBLE.replace(/maxDig/g, maxDig);
      if (!new RegExp(`^${pattern}$`).test(text)) {
        // Distinguish "not a number" from "too many decimals", which is the
        // difference between a typo and a precision constraint.
        const anyDecimal = new RegExp(`^${Numbers.PATTERN_XSD_FLOAT_AND_DOUBLE.replace(/maxDig/g, '')}$`);
        if (ni.decimalPlace != null && anyDecimal.test(text)) {
          out.push(
            this.problem(
              component,
              path,
              ValidationCode.decimalPlace,
              `More than ${ni.decimalPlace} decimal places.`,
              text,
            ),
          );
        } else {
          out.push(this.problem(component, path, ValidationCode.numberType, `Not a valid ${numberType}.`, text));
        }
        return;
      }
    }

    const numeric = Number(text);
    if (Number.isNaN(numeric)) {
      return;
    }

    // The type's own range, then any narrower range the template declares.
    //
    // Integral types compare as BigInt against the exact bounds. Going through `numeric`
    // would collapse every value near 2^63 onto the same double, which is how
    // 9223372036854775808 used to pass as an xsd:long. Reaching here as an integral type
    // means the text already matched PATTERN_XSD_INT_AND_LONG, so BigInt cannot throw.
    const bounds = numberType == null ? undefined : this.INTEGRAL_BOUNDS[numberType];
    if (bounds) {
      const exact = BigInt(text);
      if (exact < bounds[0] || exact > bounds[1]) {
        out.push(this.problem(component, path, ValidationCode.numberType, `Outside the range of ${numberType}.`, text));
      }
    }
    if (ni.minValue != null && numeric < ni.minValue) {
      out.push(this.problem(component, path, ValidationCode.minValue, `Below the minimum ${ni.minValue}.`, text));
    }
    if (ni.maxValue != null && numeric > ni.maxValue) {
      out.push(this.problem(component, path, ValidationCode.maxValue, `Above the maximum ${ni.maxValue}.`, text));
    }
  }

  /**
   * Temporal values, which nothing validated anywhere before this.
   *
   * The stored form is built by `CedarTemporalValue` as `YYYY-MM-DD`,
   * `HH:mm:ss`, the two joined by `T`, optionally a `.` and decimal seconds,
   * optionally a trailing offset. A value entered through the widget is
   * well-formed by construction; one injected by a host page is not.
   */
  private static readonly DATE_PART = /^(\d{4})-(\d{2})-(\d{2})$/;
  private static readonly TIME_PART = /^(\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?$/;
  private static readonly OFFSET_PART = /(Z|[+-]\d{2}:\d{2})$/;

  private static checkTemporal(
    component: FieldComponent,
    text: string,
    path: string[],
    out: ValidationProblem[],
  ): void {
    const temporalType = component.valueInfo.temporalType;
    const granularity = component.basicInfo.temporalGranularity;

    let rest = text;
    const offsetMatch = rest.match(this.OFFSET_PART);
    const hasOffset = offsetMatch !== null;
    if (hasOffset) {
      rest = rest.slice(0, rest.length - offsetMatch[0].length);
    }

    if (hasOffset && component.basicInfo.timezoneEnabled !== true) {
      out.push(
        this.problem(component, path, ValidationCode.timezone, 'Carries a timezone offset but none is enabled.', text),
      );
    }

    const [datePart, timePart] = rest.includes('T') ? rest.split('T') : [rest, null];
    const looksLikeTime = this.TIME_PART.test(rest);

    // Shape must match the declared temporal type.
    if (temporalType === Xsd.date) {
      if (timePart !== null || looksLikeTime || !this.DATE_PART.test(rest)) {
        out.push(this.problem(component, path, ValidationCode.temporalType, 'Not a valid xsd:date.', text));
        return;
      }
    } else if (temporalType === Xsd.time) {
      if (!looksLikeTime) {
        out.push(this.problem(component, path, ValidationCode.temporalType, 'Not a valid xsd:time.', text));
        return;
      }
    } else if (temporalType === Xsd.dateTime) {
      if (timePart === null || !this.DATE_PART.test(datePart) || !this.TIME_PART.test(timePart)) {
        out.push(this.problem(component, path, ValidationCode.temporalType, 'Not a valid xsd:dateTime.', text));
        return;
      }
    }

    const dateStr = temporalType === Xsd.time ? null : timePart !== null ? datePart : rest;
    const timeStr = temporalType === Xsd.time ? rest : timePart;

    if (dateStr !== null && this.DATE_PART.test(dateStr)) {
      // `?? []` because `String.match` types its result nullable; the `test` on the
      // line above already established the groups are there.
      const [, y, mo, d] = dateStr.match(this.DATE_PART) ?? [];
      const month = Number(mo);
      const day = Number(d);
      const daysInMonth = new Date(Number(y), month, 0).getDate();
      if (month < 1 || month > 12 || day < 1 || (daysInMonth && day > daysInMonth)) {
        out.push(this.problem(component, path, ValidationCode.temporalCalendar, 'Not a real calendar date.', text));
      }
    }
    if (timeStr !== null && this.TIME_PART.test(timeStr)) {
      const [, h, mi, sec] = timeStr.match(this.TIME_PART) ?? [];
      if (Number(h) > 23 || Number(mi) > 59 || (sec !== undefined && Number(sec) > 59)) {
        out.push(this.problem(component, path, ValidationCode.temporalCalendar, 'Not a real time of day.', text));
      }
    }

    this.checkGranularity(component, text, granularity, dateStr, timeStr, path, out);
  }

  /**
   * Granularity says which parts the user supplies. The stored XSD lexical value
   * remains complete, so hidden parts are permitted only at their neutral value:
   * a year is `YYYY-01-01`, a minute is `HH:mm:00`, and a dateTime whose
   * granularity stops at the day ends in `T00:00:00`.
   *
   * This is also the boundary for legacy values. The editor normalizes finer
   * information away when it loads them; validation still reports the original
   * value as over-precise until that normalization has happened.
   */
  private static checkGranularity(
    component: FieldComponent,
    text: string,
    /** Null for a temporal field whose template declares no granularity, which the guard below has always expected. */
    granularity: string | null,
    dateStr: string | null,
    timeStr: string | null,
    path: string[],
    out: ValidationProblem[],
  ): void {
    if (granularity == null) {
      return;
    }
    const dateOnly = [Temporal.year, Temporal.month, Temporal.day];
    const dateParts = dateStr?.match(this.DATE_PART) ?? null;
    if (dateParts !== null) {
      const [, , month, day] = dateParts;
      if (granularity === Temporal.year && (month !== '01' || day !== '01')) {
        out.push(
          this.problem(
            component,
            path,
            ValidationCode.temporalGranularity,
            'Granularity is year, but the padded month or day is not 01.',
            text,
          ),
        );
      } else if (granularity === Temporal.month && day !== '01') {
        out.push(
          this.problem(
            component,
            path,
            ValidationCode.temporalGranularity,
            'Granularity is month, but the padded day is not 01.',
            text,
          ),
        );
      }
    }

    const timeParts = timeStr?.match(this.TIME_PART) ?? null;
    const timeIsPaddedMidnight =
      timeParts !== null &&
      timeParts[1] === '00' &&
      timeParts[2] === '00' &&
      (timeParts[3] === undefined || timeParts[3] === '00') &&
      timeParts[4] === undefined;
    const dateTimePadding = component.valueInfo.temporalType === Xsd.dateTime && timeIsPaddedMidnight;
    if (dateOnly.includes(granularity) && timeStr !== null && !dateTimePadding) {
      out.push(
        this.problem(
          component,
          path,
          ValidationCode.temporalGranularity,
          `Granularity is ${granularity}, but the padded time is not midnight.`,
          text,
        ),
      );
      return;
    }
    if (timeStr === null) {
      return;
    }
    const parts = timeStr.match(this.TIME_PART);
    const hasSeconds = parts !== null && parts[3] !== undefined;
    const hasDecimal = parts !== null && parts[4] !== undefined;

    if ((granularity === Temporal.second || granularity === Temporal.decimalSecond) && !hasSeconds) {
      out.push(
        this.problem(
          component,
          path,
          ValidationCode.temporalGranularity,
          `Granularity is ${granularity}, but the value has no seconds.`,
          text,
        ),
      );
    }
    if (granularity === Temporal.decimalSecond && hasSeconds && !hasDecimal) {
      out.push(
        this.problem(
          component,
          path,
          ValidationCode.temporalGranularity,
          'Granularity is decimalSecond, but the value has no fractional seconds.',
          text,
        ),
      );
    }
    const finerThanHour =
      granularity === Temporal.hour &&
      parts !== null &&
      (parts[2] !== '00' || (hasSeconds && parts[3] !== '00') || hasDecimal);
    const finerThanMinute =
      granularity === Temporal.minute && parts !== null && ((hasSeconds && parts[3] !== '00') || hasDecimal);
    const finerThanSecond = granularity === Temporal.second && hasDecimal;
    if (finerThanHour || finerThanMinute || finerThanSecond) {
      out.push(
        this.problem(
          component,
          path,
          ValidationCode.temporalGranularity,
          `Granularity is ${granularity}, but the value contains finer information.`,
          text,
        ),
      );
    }
  }

  private static checkChoiceMembership(
    component: FieldComponent,
    text: string,
    path: string[],
    out: ValidationProblem[],
  ): void {
    const labels = component.choiceInfo.choices.map((c) => c.label);
    if (!labels.includes(text)) {
      out.push(
        this.problem(
          component,
          path,
          ValidationCode.choiceMembership,
          `Not one of the declared options: ${labels.join(', ')}.`,
          text,
        ),
      );
    }
  }

  /**
   * Structural checks on a controlled-term node.
   *
   * Takes the raw node rather than the extracted value, because the point is
   * the shape: a controlled term is an `@id` and an `rdfs:label` travelling
   * together. Whether the term is a member of the declared ontologies, value
   * sets, classes or branches cannot be answered without the terminology
   * server and is deliberately not attempted.
   */
  static validateControlledNode(component: FieldComponent, node: InstanceNode, path: string[]): ValidationProblem[] {
    if (component.basicInfo.inputType !== InputType.controlled) {
      return [];
    }
    if (!isInstanceObject(node)) {
      return [];
    }
    // Read the id and label through the value-node model rather than off the raw
    // keys, so this validator sees a controlled term the same way everything else
    // in CEE does. A node the model does not read as an id/label pair — a bare
    // `rdfs:label` with no `@id`, say — is not a controlled value to it, and is
    // left alone here too.
    const id = InstanceValueNode.iri(node);
    const label = InstanceValueNode.label(node);
    const hasId = typeof id === 'string' && id !== '';
    const hasLabel = typeof label === 'string' && label !== '';

    if (!hasId && !hasLabel) {
      return [];
    }
    const out: ValidationProblem[] = [];
    if (hasId !== hasLabel) {
      out.push(
        this.problem(
          component,
          path,
          ValidationCode.controlledStructure,
          hasId ? 'Has @id but no rdfs:label.' : 'Has rdfs:label but no @id.',
          node,
        ),
      );
    }
    if (hasId && !this.IRI.test(id as string)) {
      out.push(this.problem(component, path, ValidationCode.iriMalformed, '@id is not a valid IRI.', id));
    }
    return out;
  }
}
