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
import { TimezonePickerComponent, TZone } from '../../../shared/components/timezone-picker/timezone-picker.component';
import {
  CedarTemporalConfiguration,
  CedarTemporalParts,
  CedarTemporalValue,
} from '../../../shared/util/cedar-temporal-value';

/** A part of a temporal value the user supplies, in the order the controls stand. */
export type TemporalPart = 'date' | 'time' | 'fraction';

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
  dateMonthYearControl = new FormControl<Date | null>(null);
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
   * Set on two signals, and both are needed. `writeValue` is one: only the part
   * handlers and the clear action reach it, and each of those is a user acting
   * on a part, while a value the model pushes in arrives through
   * `setCurrentValue` and never comes near it. The host listeners below are the
   * other: a keystroke the clock rejects emits nothing and reaches no handler,
   * and still leaves a field somebody has touched. Until `writeValue` set it, a
   * date picked from the calendar and an offset chosen from the list set it
   * through neither — Material dispatches no DOM event for either — so a
   * required dateTime with only its date picked stored nothing and said nothing.
   */
  userEdited = false;

  /**
   * A stored value this widget could not read, or null.
   *
   * Kept so the empty pickers can be explained. It is cleared by the next value
   * that parses, including the one an edit produces.
   */
  unreadableValue: string | null = null;

  @HostListener('input')
  @HostListener('change')
  onUserEdit(): void {
    this.userEdited = true;
  }

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
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  dateInputChanged(event: Date): void {
    this.datetimeParsed.setDate(event);
    this.writeValue();
  }

  timeInputChanged(_event: unknown): void {
    if (this.timePickerTime === null) {
      return;
    }
    this.datetimeParsed.setHours(this.timePickerTime.getHours());

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

  timezoneInputChanged(event: TZone | null): void {
    this.datetimeParsed.setTimezone(event);
    this.writeValue();
  }

  hasTemporalValue(): boolean {
    return this.datetimeParsed.dateIsSet || this.datetimeParsed.timeIsSet || this.datetimeParsed.timezoneIsSet;
  }

  clearValue(): void {
    this.datetimeParsed = new DatetimeRepresentation();
    this.dateMonthYearControl.reset(null, { emitEvent: false });
    this.timePickerTime = null;
    this.decimalSeconds = null;
    this.timezone = null;
    this.writeValue();
  }

  /**
   * What the field holds, cut to the granularity it records.
   *
   * The control stores an instant, so a day-granularity field holds `2026-08-09T00:00:00` and a
   * to-the-minute one holds `21:45:00`. Shown verbatim, a date field asserted a midnight nobody
   * entered and a minute field asserted a zero second — and the `T` is a serialization's separator,
   * not something to read. Each part is cut to what the field records and the parts are joined the
   * way the notation beside them joins, with a space. A zone offset is kept whole: it is one value,
   * and no granularity trims it.
   */
  readOnlyValue(): string {
    const held = this.valueControl.value;
    if (typeof held !== 'string' || held === '') {
      return '';
    }
    const granularity = this.component.basicInfo.temporalGranularity ?? '';
    const zone = held.match(/(Z|[+-]\d{2}:\d{2})$/)?.[0] ?? '';
    const body = zone === '' ? held : held.slice(0, -zone.length);
    const [datePart, timePart] = body.includes('T') ? body.split('T') : body.includes(':') ? ['', body] : [body, ''];
    const dateLength = { [Temporal.year]: 4, [Temporal.month]: 7, [Temporal.day]: 10 }[granularity];
    const timeLength = {
      [Temporal.hour]: 2,
      [Temporal.minute]: 5,
      [Temporal.second]: 8,
      [Temporal.decimalSecond]: 12,
    }[granularity];
    const date = datePart === '' ? '' : datePart.slice(0, dateLength ?? datePart.length);
    const time = timePart === '' || timeLength === undefined ? '' : timePart.slice(0, timeLength);
    return [date, time, zone].filter((part) => part !== '').join(' ');
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

  /**
   * Which part of a value the user has begun is still missing, or null.
   *
   * A dateTime records nothing until it has both its date and its time, and a
   * decimal-second field nothing until it has its fraction. The box meanwhile
   * showed the parts entered over an instance holding null and said nothing —
   * for a required field until the requirement spoke, for an optional one for
   * good. Named in the order the controls stand, so a field missing both its
   * date and its time asks for the date first. Nothing to say while reading,
   * before the user has touched the field, or once the value is whole.
   */
  get missingPart(): TemporalPart | null {
    if (this.readOnlyMode || !this.userEdited || !this.hasTemporalValue() || this.valueControl.value !== null) {
      return null;
    }
    const temporalType = this.component.valueInfo.temporalType;
    if ((temporalType === Xsd.dateTime || temporalType === Xsd.date) && !this.datetimeParsed.dateIsSet) {
      return 'date';
    }
    if ((temporalType === Xsd.dateTime || temporalType === Xsd.time) && !this.datetimeParsed.timeIsSet) {
      return 'time';
    }
    if (this.showDecimalSeconds() && this.datetimeParsed.decimalSeconds.length === 0) {
      return 'fraction';
    }
    return null;
  }

  /** The message for each part the value may still lack, for the template's translate pipe. */
  readonly missingPartKeys: Record<TemporalPart, string> = {
    date: 'Validation.Temporal.MissingDate',
    time: 'Validation.Temporal.MissingTime',
    fraction: 'Validation.Temporal.MissingFraction',
  };

  /**
   * Whether to state what is wrong with the value.
   *
   * Two ways to earn it. An edit the user made, which is what `userEdited` is
   * for — an error on a form nobody has touched says nothing useful. And a
   * stored value the widget could not read, where the pickers are necessarily
   * empty and staying quiet would leave a blank field over an instance holding
   * something, with nothing on screen connecting the two. A value still being
   * entered is `missingPart`'s to describe, and a requirement waits behind it:
   * "a time is still needed" says more than "the value is required" about a
   * field whose date is already in.
   */
  get showsValidationMessage(): boolean {
    return (
      !this.readOnlyMode &&
      this.missingPart === null &&
      (this.unreadableValue !== null || (this.valueControl.invalid && this.userEdited))
    );
  }

  private writeValue(): void {
    // Only a user reaches here; see `userEdited`.
    this.userEdited = true;
    const stored = this.datetimeParsed.toStorageRepresentation(this.temporalConfiguration());
    // An edit replaces whatever could not be read, so the notice about it goes.
    this.unreadableValue = null;
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
    const parsed = stored === null ? null : CedarTemporalValue.parse(stored, configuration);

    /*
     * Nothing to show, whether the field holds nothing or holds something this
     * widget cannot read — a bare `2021-06-06` in an `xsd:dateTime` field, which
     * a hand-written or migrated instance readily carries.
     *
     * The unreadable case used to return here without touching a single picker,
     * and the same widget is reused as a repeating field pages between
     * occurrences. So occurrence one's instant stayed on screen over occurrence
     * two, and the next edit of any part serialized those stale parts back and
     * overwrote occurrence two with occurrence one's value.
     */
    this.unreadableValue = parsed === null && stored !== null ? stored : null;
    if (parsed === null) {
      this.clearDisplayedParts();
      return;
    }

    this.datetimeParsed = DatetimeRepresentation.fromTemporalParts(parsed);
    const normalized = this.datetimeParsed.toStorageRepresentation(configuration);

    // Each part is shown when the value carries it and cleared when it does not.
    // Only the zone was cleared before, which is what marked the other two as an
    // omission rather than a decision.
    if (this.datetimeParsed.dateIsSet) {
      const date = new Date(0);
      date.setHours(0, 0, 0, 0);
      date.setFullYear(+this.datetimeParsed.year, +this.datetimeParsed.month - 1, +this.datetimeParsed.day);
      this.dateMonthYearControl.setValue(date, { emitEvent: false });
    } else {
      this.dateMonthYearControl.reset(null, { emitEvent: false });
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
      this.decimalSeconds = this.datetimeParsed.decimalSeconds.length > 0 ? this.datetimeParsed.decimalSeconds : null;
    } else {
      this.timePickerTime = null;
      this.decimalSeconds = null;
    }

    this.timezone = this.datetimeParsed.timezoneIsSet
      ? { id: this.datetimeParsed.timezoneOffset, label: this.datetimeParsed.timezoneName }
      : null;

    if (normalized !== null && normalized !== stored) {
      this.revalidate(normalized);
      this.handlerContext.changeValue(this.component, normalized);
    }
  }

  private clearDisplayedParts(): void {
    this.datetimeParsed = new DatetimeRepresentation();
    this.dateMonthYearControl.reset(null, { emitEvent: false });
    this.timePickerTime = null;
    this.decimalSeconds = null;
    this.timezone = null;
  }
}

export class DatetimeRepresentation {
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

    this.timezoneName = '';
    this.timezoneOffset = '';
  }

  static fromTemporalParts(parts: CedarTemporalParts): DatetimeRepresentation {
    const that = new DatetimeRepresentation();
    if (parts.year !== null && parts.month !== null && parts.day !== null) {
      that.dateIsSet = true;
      that.year = parts.year;
      that.month = parts.month;
      that.day = parts.day;
    }
    if (parts.hour !== null && parts.minute !== null && parts.second !== null) {
      that.timeIsSet = true;
      that.hours = parts.hour;
      that.minutes = parts.minute;
      that.seconds = parts.second;
      that.decimalSeconds = parts.fraction ?? '';
    }
    if (parts.offset !== null) {
      that.setTimezone(TimezonePickerComponent.zoneForOffset(parts.offset));
    }
    return that;
  }

  setDate(dateIn: Date): void {
    if (!dateIn) {
      return;
    }
    this.dateIsSet = true;
    this.year = dateIn.getFullYear().toString().padStart(4, '0');
    this.month = this.stringify(dateIn.getMonth() + 1);
    this.day = this.stringify(dateIn.getDate());
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
