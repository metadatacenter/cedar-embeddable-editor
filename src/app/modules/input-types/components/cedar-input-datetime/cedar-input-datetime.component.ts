import {
  AfterViewInit,
  Component,
  HostListener,
  Input,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { CedarValidators } from '../../../shared/validation/cedar-validators';
import { CedarUIDirective } from '../../../shared/models/ui/cedar-ui-component.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { HandlerContext } from '../../../shared/util/handler-context';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { Xsd } from '../../../shared/models/xsd.model';
import { Temporal } from '../../../shared/models/temporal.model';
import moment, { Moment } from 'moment';
import { TimezonePickerComponent, TZone } from '../../../shared/components/timezone-picker/timezone-picker.component';
import {
  CedarTemporalConfiguration,
  CedarTemporalParts,
  CedarTemporalValue,
} from '../../../shared/util/cedar-temporal-value';

@Component({
  selector: 'app-cedar-input-datetime',
  templateUrl: './cedar-input-datetime.component.html',
  styleUrls: ['./cedar-input-datetime.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarInputDatetimeComponent extends CedarUIDirective implements AfterViewInit {
  component!: FieldComponent;

  timePickerTime: Date | null;
  /** Both null when the field holds no time yet, and reset to null on clear. */
  decimalSeconds: string | null = null;
  timezone: TZone | null = null;
  setDefaultZone = false;
  datetimeParsed: DatetimeRepresentation;
  /** An empty date control until a value or a default replaces it. */
  dateMonthYearControl: FormControl = new FormControl(null);
  /**
   * Carries the stored representation so it can be validated.
   *
   * A value entered through this widget is well-formed by construction —
   * `toStorageRepresentation` concatenates the parts. A value arriving from a
   * host page's injected instance is not, and until now nothing checked it:
   * temporal was the only field type with no validators at all, despite having
   * the most declared structure to check against.
   */
  valueControl: FormControl = new FormControl<string | null>(null);
  /**
   * Whether the user has actually edited this field.
   *
   * Needed because the component writes a value several times while
   * initialising — the date default is applied before the time, so the stored
   * representation is briefly date-only, which does not satisfy an
   * `xsd:dateTime`. Reporting that would put an error on a form nobody has
   * touched.
   *
   * Driven by real DOM events rather than by the change handlers: assigning
   * `timePickerTime` fires the timepicker's `ngModelChange` exactly as a user
   * edit does, and `setCurrentValue` can arrive on a later tick, so neither the
   * handlers nor a post-init reset can tell the two apart. A programmatic
   * assignment dispatches no `input` or `change` event; a user action does.
   */
  userEdited = false;

  @HostListener('input')
  @HostListener('change')
  onUserEdit(): void {
    this.userEdited = true;
  }
  required = false;

  @Input({ required: true }) handlerContext!: HandlerContext;

  constructor(
    fb: FormBuilder,
    private activeComponentRegistry: ActiveComponentRegistryService,
  ) {
    super();
    this.datetimeParsed = new DatetimeRepresentation();
    this.timePickerTime = null;
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  @Input({ required: true }) set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    const validators = [CedarValidators.forComponent(componentToRender)];
    if (componentToRender.valueInfo.requiredValue) {
      validators.push(Validators.required);
    }
    this.valueControl.setValidators(validators);
    this.required = this.component.valueInfo.requiredValue;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  dateInputChanged(event: Moment): void {
    this.datetimeParsed.setDate(event);
    this.writeValue();
  }

  timeInputChanged(_event: unknown): void {
    if (this.timePickerTime === null) {
      return;
    }
    this.datetimeParsed.setHours(this.timePickerTime.getHours());
    this.datetimeParsed.setAMPM(this.enableMeridian());

    if (!this.disableMinute()) {
      this.datetimeParsed.setMinutes(this.timePickerTime.getMinutes());
    }

    if (this.showSeconds()) {
      this.datetimeParsed.setSeconds(this.timePickerTime.getSeconds());
    }
    this.writeValue();
  }

  decimalSecondsChanged(_event: unknown): void {
    this.datetimeParsed.setDecimalSeconds(this.decimalSeconds);
    this.writeValue();
  }

  timezoneInputChanged(event: TZone): void {
    if (event != null) {
      this.datetimeParsed.setTimezone(event);
      this.writeValue();
    }
  }

  showDatePicker(): boolean {
    const temporalType = this.component.valueInfo.temporalType;
    return temporalType != null && [Xsd.dateTime, Xsd.date].includes(temporalType);
  }

  dateFormat(): string {
    let format = DatePickerComponent.YEAR_MONTH_DAY_FORMAT;

    switch (this.component.basicInfo.temporalGranularity) {
      case Temporal.month:
        format = DatePickerComponent.YEAR_MONTH_FORMAT;
        break;
      case Temporal.year:
        format = DatePickerComponent.YEAR_FORMAT;
        break;
    }
    return format;
  }

  showTimePicker(): boolean {
    const temporalType = this.component.valueInfo.temporalType;
    const granularity = this.component.basicInfo.temporalGranularity;
    const timeGranularities = [Temporal.hour, Temporal.minute, Temporal.second, Temporal.decimalSecond];
    return (
      temporalType != null &&
      [Xsd.dateTime, Xsd.time].includes(temporalType) &&
      timeGranularities.includes(granularity ?? '')
    );
  }

  enableMeridian(): boolean {
    return this.component.basicInfo.inputTimeFormat === Temporal.inputType12h;
  }

  disableMinute(): boolean {
    return this.component.basicInfo.temporalGranularity === Temporal.hour;
  }

  showSeconds(): boolean {
    const granularity = this.component.basicInfo.temporalGranularity;
    return granularity != null && [Temporal.second, Temporal.decimalSecond].includes(granularity);
  }

  showDecimalSeconds(): boolean {
    return this.component.basicInfo.temporalGranularity === Temporal.decimalSecond;
  }

  showTimezonePicker(): boolean {
    return this.component.basicInfo.timezoneEnabled === true;
  }

  /** Re-run validation against the current stored representation. */
  private revalidate(stored: string | null): void {
    this.valueControl.setValue(stored, { emitEvent: false });
    this.valueControl.updateValueAndValidity({ emitEvent: false });
  }

  /** Message for whichever constraint the current value violates. */
  validationMessage(): string {
    return CedarValidators.firstMessage(this.valueControl) ?? 'The value is required.';
  }

  private writeValue(): void {
    const stored = this.datetimeParsed.toStorageRepresentation(this.temporalConfiguration());
    this.revalidate(stored);
    this.handlerContext.changeValue(this.component, stored);
  }

  private temporalConfiguration(): CedarTemporalConfiguration {
    return {
      temporalType: this.component.valueInfo.temporalType,
      granularity: this.component.basicInfo.temporalGranularity,
      timezoneEnabled: this.component.basicInfo.timezoneEnabled === true,
    };
  }

  setCurrentValue(currentValue: unknown): void {
    const configuration = this.temporalConfiguration();
    const stored = typeof currentValue === 'string' ? currentValue : null;
    this.revalidate(stored);
    if (stored) {
      const parsed = CedarTemporalValue.parse(stored, configuration);
      if (parsed === null) {
        return;
      }
      this.datetimeParsed = DatetimeRepresentation.fromTemporalParts(parsed, this.enableMeridian());
      const normalized = this.datetimeParsed.toStorageRepresentation(configuration);

      if (this.datetimeParsed.dateIsSet) {
        const m = moment();
        m.set('date', +this.datetimeParsed.day);
        m.set('month', +this.datetimeParsed.month - 1);
        m.set('year', +this.datetimeParsed.year);
        this.dateMonthYearControl = new FormControl(m);
      }

      if (this.datetimeParsed.timeIsSet) {
        // reset timepicker UI
        this.timePickerTime = new Date();
        this.timePickerTime.setHours(
          +this.datetimeParsed.hours,
          +this.datetimeParsed.minutes,
          +this.datetimeParsed.seconds,
        );

        // reset decimal seconds
        if (this.datetimeParsed.decimalSeconds.length > 0) {
          this.decimalSeconds = this.datetimeParsed.decimalSeconds;
        } else {
          this.decimalSeconds = null;
        }
      }
      if (this.datetimeParsed.timezoneIsSet) {
        this.timezone = {
          id: this.datetimeParsed.timezoneOffset,
          label: this.datetimeParsed.timezoneName,
        };
      } else {
        this.timezone = null;
      }
      if (normalized !== null && normalized !== stored) {
        this.revalidate(normalized);
        this.handlerContext.changeValue(this.component, normalized);
      }
    }
    // set datetime UI to default view
    else {
      // Following 2 lines puts the today's date in the date picker and time, which should not be the default behaviour
      // this.resetDate();
      // this.resetTime();
    }
  }

  private resetDate(): void {
    if (this.showDatePicker()) {
      const defDate = this.getDefaultDate();
      this.dateMonthYearControl = new FormControl(defDate);
      this.datetimeParsed.setDate(defDate);
      this.writeValue();
    }
  }

  private resetTime(): void {
    if (this.showTimePicker()) {
      this.timePickerTime = this.getDefaultTime();
      this.decimalSeconds = null;
      this.datetimeParsed.setDecimalSeconds(null);
      this.resetTimezone();
      this.writeValue();
    }
  }

  private resetTimezone(): void {
    if (this.showTimezonePicker()) {
      let tz = null;

      if (this.setDefaultZone) {
        tz = TimezonePickerComponent.guessedUserZone();
      }
      this.timezone = tz;
      this.datetimeParsed.setTimezone(tz);
      this.writeValue();
    }
  }

  private getDefaultDate(): Moment {
    const dt = moment();
    const format = this.dateFormat();

    switch (format) {
      case DatePickerComponent.YEAR_MONTH_FORMAT:
        dt.set('date', 1);
        break;
      case DatePickerComponent.YEAR_FORMAT:
        dt.set('date', 1);
        dt.set('month', 0);
        break;
    }
    return dt;
  }

  private getDefaultTime(): Date {
    const dt = new Date();
    // dt.setHours(0,0,0,0);
    return dt;
  }
}

export class DatetimeRepresentation {
  static readonly DATE_SEPARATOR = '-';
  static readonly TIME_SEPARATOR = ':';
  static readonly DATE_TIME_SEPARATOR = 'T';
  static readonly TIME_DECIMAL_SECOND_SEPARATOR = '.';
  static readonly DATE_STORED_FORMAT = 'YYYY-MM-DD';

  dateIsSet: boolean;
  timeIsSet: boolean;
  timezoneIsSet: boolean;

  year: string;
  month: string;
  day: string;

  hours: string;
  minutes: string;
  seconds: string;
  decimalSeconds: string;
  ampm: boolean;

  timezoneName: string;
  timezoneOffset: string;

  constructor() {
    // set default values
    const DEF_ZERO = '00';
    const DEF_ONE = '01';

    this.dateIsSet = false;
    this.timeIsSet = false;
    this.timezoneIsSet = false;

    this.year = '';
    this.month = DEF_ONE;
    this.day = DEF_ONE;

    this.hours = DEF_ZERO;
    this.minutes = DEF_ZERO;
    this.seconds = DEF_ZERO;
    this.decimalSeconds = '';
    this.ampm = true;

    this.timezoneName = '';
    this.timezoneOffset = '';
  }

  static fromTemporalParts(parts: CedarTemporalParts, ampm: boolean): DatetimeRepresentation {
    const that = new DatetimeRepresentation();
    if (parts.year !== null && parts.month !== null && parts.day !== null) {
      that.dateIsSet = true;
      that.year = parts.year;
      that.month = parts.month;
      that.day = parts.day;
    }
    if (parts.hour !== null && parts.minute !== null && parts.second !== null) {
      that.timeIsSet = true;
      that.setAMPM(ampm);
      that.hours = parts.hour;
      that.minutes = parts.minute;
      that.seconds = parts.second;
      that.decimalSeconds = parts.fraction ?? '';
    }
    if (parts.offset !== null) {
      const timezone = TimezonePickerComponent.AVAILABLE_TIMEZONES.find((z) => z.id === parts.offset);
      that.setTimezone(timezone ?? { id: parts.offset, label: `UTC${parts.offset === 'Z' ? '' : parts.offset}` });
    }
    return that;
  }

  static regexIndexOf(text: string, re: RegExp, i: number): number {
    const indexInSuffix = text.slice(i).search(re);
    return indexInSuffix < 0 ? indexInSuffix : indexInSuffix + i;
  }

  static indexOfEnd(sourceStr: string, matchStr: string): number {
    const io = sourceStr.indexOf(matchStr);
    return io === -1 ? -1 : io + matchStr.length;
  }

  setDate(dateIn: Moment): void {
    if (!dateIn) {
      return;
    }
    this.dateIsSet = true;
    this.year = dateIn.year().toLocaleString().replace(/,/, '');
    // Passed as numbers. `stringify` pads anything below 10, which it did by
    // comparing a string to a number and letting JavaScript coerce it; these two
    // call sites were also stringifying with `toLocaleString()` only for
    // `stringify` to call `toString()` on the result. Months and days never reach
    // the grouping separator that made `toLocaleString()` worth using for the year
    // on the line above, so nothing about the output changes.
    this.month = this.stringify(dateIn.month() + 1);
    this.day = this.stringify(dateIn.date());
  }

  setHours(hoursIn: number): void {
    this.timeIsSet = true;
    this.hours = this.stringify(hoursIn);
  }

  setMinutes(minutesIn: number): void {
    this.timeIsSet = true;
    this.minutes = this.stringify(minutesIn);
  }

  setSeconds(secondsIn: number): void {
    this.timeIsSet = true;
    this.seconds = this.stringify(secondsIn);
  }

  setAMPM(val: boolean): void {
    this.ampm = val;
  }

  setDecimalSeconds(decSecondsIn: string | null): void {
    this.timeIsSet = true;

    if (decSecondsIn == null) {
      this.decimalSeconds = '';
    } else {
      this.decimalSeconds = decSecondsIn.replace(/^0\./, '').replace(/^\./, '');
    }
  }

  setTimezone(timezoneIn: TZone | null): void {
    if (timezoneIn) {
      this.timezoneIsSet = true;
      this.timezoneOffset = timezoneIn.id;
      this.timezoneName = timezoneIn.label;
    } else {
      this.timezoneIsSet = false;
      this.timezoneOffset = '';
      this.timezoneName = '';
    }
  }

  toDateRepresentation(): string {
    const m = moment();
    const formatArr = [];

    if (this.timezoneIsSet) {
      m.utcOffset(this.timezoneOffset);
    }

    if (this.dateIsSet) {
      m.set({ year: +this.year, month: +this.month - 1, date: +this.day });
      formatArr.push(DatePickerComponent.YEAR_MONTH_DAY_FORMAT);
    }

    if (this.timeIsSet) {
      m.set({ hour: +this.hours, minute: +this.minutes, second: +this.seconds });

      if (this.dateIsSet) {
        formatArr.push(' ');
      }

      if (this.ampm) {
        formatArr.push('hh:mm:ss A');
      } else {
        formatArr.push('HH:mm:ss'); // 24-hour clock time
      }
    }

    if (this.timezoneIsSet) {
      formatArr.push('Z');
    }
    return m.format(formatArr.join(''));
  }

  toStorageRepresentation(configuration: CedarTemporalConfiguration): string | null {
    return CedarTemporalValue.serialize(this.toTemporalParts(), configuration);
  }

  private toTemporalParts(): CedarTemporalParts {
    return {
      year: this.dateIsSet ? this.year : null,
      month: this.dateIsSet ? this.month : null,
      day: this.dateIsSet ? this.day : null,
      hour: this.timeIsSet ? this.hours : null,
      minute: this.timeIsSet ? this.minutes : null,
      second: this.timeIsSet ? this.seconds : null,
      fraction: this.timeIsSet && this.decimalSeconds.length > 0 ? this.decimalSeconds : null,
      offset: this.timezoneIsSet ? this.timezoneOffset : null,
    };
  }

  private stringify(valIn: number): string {
    let str = valIn.toString();
    if (valIn < 10) {
      str = '0' + str;
    }
    return str;
  }
}
