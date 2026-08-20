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
    this.userEdited = true;
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
      this.datetimeParsed = DatetimeRepresentation.fromTemporalParts(parsed);
      const normalized = this.datetimeParsed.toStorageRepresentation(configuration);

      if (this.datetimeParsed.dateIsSet) {
        const date = new Date(0);
        date.setHours(0, 0, 0, 0);
        date.setFullYear(+this.datetimeParsed.year, +this.datetimeParsed.month - 1, +this.datetimeParsed.day);
        this.dateMonthYearControl.setValue(date, { emitEvent: false });
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
