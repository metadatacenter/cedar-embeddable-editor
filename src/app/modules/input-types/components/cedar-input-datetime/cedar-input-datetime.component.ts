import {AfterViewInit, ChangeDetectorRef, Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder, FormControl} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';
import {DatePickerComponent} from '../../../shared/components/date-picker/date-picker.component';
import {Xsd} from '../../../shared/models/xsd.model';
import {Temporal} from '../../../shared/models/temporal.model';
import moment, {Moment} from 'moment';
import {TimezonePickerComponent, TZone} from '../../../shared/components/timezone-picker/timezone-picker.component';
// import {Moment} from 'moment';
// import * as moment from 'moment-timezone';


@Component({
  selector: 'app-cedar-input-datetime',
  templateUrl: './cedar-input-datetime.component.html',
  styleUrls: ['./cedar-input-datetime.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class CedarInputDatetimeComponent extends CedarUIComponent implements OnInit, AfterViewInit {

  readonly YEAR_FORMAT = DatePickerComponent.YEAR_FORMAT;
  readonly YEAR_MONTH_FORMAT = DatePickerComponent.YEAR_MONTH_FORMAT;
  readonly YEAR_MONTH_DAY_FORMAT = DatePickerComponent.YEAR_MONTH_DAY_FORMAT;

  component: FieldComponent;
  activeComponentRegistry: ActiveComponentRegistryService;

  timePickerTime: Date;
  decimalSeconds: number;
  timezone: TZone;
  setDefaultZone = false;
  datetimeParsed: DatetimeRepresentation;
  dateMonthYearControl: FormControl;

  @Input() handlerContext: HandlerContext;


  constructor(fb: FormBuilder, public cds: ComponentDataService,
              activeComponentRegistry: ActiveComponentRegistryService, private cdr: ChangeDetectorRef) {
    super();
    this.activeComponentRegistry = activeComponentRegistry;
    this.datetimeParsed = new DatetimeRepresentation();
    this.timePickerTime = this.getDefaultTime();
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  dateInputChanged(event): void {
    this.datetimeParsed.setDate(event);
    this.handlerContext.changeValue(this.component, this.datetimeParsed.toStorageRepresentation());
  }

  timeInputChanged(event): void {
    this.datetimeParsed.setHours(this.timePickerTime.getHours());
    this.datetimeParsed.setAMPM(this.enableMeridian());

    if (!this.disableMinute()) {
      this.datetimeParsed.setMinutes(this.timePickerTime.getMinutes());
    }

    if (this.showSeconds()) {
      this.datetimeParsed.setSeconds(this.timePickerTime.getSeconds());
    }
    this.handlerContext.changeValue(this.component, this.datetimeParsed.toStorageRepresentation());
  }

  decimalSecondsChanged(event): void {
    this.datetimeParsed.setDecimalSeconds(this.decimalSeconds);
    this.handlerContext.changeValue(this.component, this.datetimeParsed.toStorageRepresentation());
  }

  timezoneInputChanged(event): void {
    if (event != null) {
      this.datetimeParsed.setTimezone(event);
      this.handlerContext.changeValue(this.component, this.datetimeParsed.toStorageRepresentation());
    }
  }

  showDatePicker(): boolean {
    return [Xsd.dateTime, Xsd.date].indexOf(this.component.valueInfo.temporalType) > -1;
  }

  dateFormat(): string {
    let format = DatePickerComponent.YEAR_MONTH_DAY_FORMAT;

    if (this.component.valueInfo.temporalType === Xsd.date) {
      switch (this.component.basicInfo.temporalGranularity) {
        case Temporal.month:
          format = DatePickerComponent.YEAR_MONTH_FORMAT;
          break;
        case Temporal.year:
          format = DatePickerComponent.YEAR_FORMAT;
          break;
      }
    }
    return format;
  }

  showTimePicker(): boolean {
    return [Xsd.dateTime, Xsd.time].indexOf(this.component.valueInfo.temporalType) > -1;
  }

  enableMeridian(): boolean {
    return (this.component.basicInfo.inputTimeFormat === Temporal.inputType12h);
  }

  disableMinute(): boolean {
    return (this.component.basicInfo.temporalGranularity === Temporal.hour);
  }

  showSeconds(): boolean {
    return [Temporal.second, Temporal.decimalSecond].indexOf(this.component.basicInfo.temporalGranularity) > -1;
  }

  showDecimalSeconds(): boolean {
    return (this.component.basicInfo.temporalGranularity === Temporal.decimalSecond);
  }

  showTimezonePicker(): boolean {
    return (this.component.basicInfo.timezoneEnabled === true);
  }

  setCurrentValue(currentValue: any): void {
    if (currentValue) {
      this.datetimeParsed = DatetimeRepresentation.fromStorageRepresentation(currentValue as string, this.enableMeridian());

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
        this.timePickerTime.setHours(+this.datetimeParsed.hours, +this.datetimeParsed.minutes, +this.datetimeParsed.seconds);

        // reset decimal seconds
        if (this.datetimeParsed.decimalSeconds.length > 0) {
          this.decimalSeconds = +this.datetimeParsed.decimalSeconds;
        } else {
          this.decimalSeconds = null;
        }

        if (this.datetimeParsed.timezoneIsSet) {
          this.timezone = {
            id: this.datetimeParsed.timezoneOffset,
            label: this.datetimeParsed.timezoneName
          };
        } else {
          this.resetTimezone();
        }
      }
    }
    // set datetime UI to default view
    else {
      this.resetDate();
      this.resetTime();
    }
  }

  private resetDate(): void {
    if (this.showDatePicker()) {
      const defDate = this.getDefaultDate();
      this.dateMonthYearControl = new FormControl(defDate);
      this.datetimeParsed.setDate(defDate);
      this.handlerContext.changeValue(this.component, this.datetimeParsed.toStorageRepresentation());
    }
  }

  private resetTime(): void {
    if (this.showTimePicker()) {
      this.timePickerTime = this.getDefaultTime();
      this.decimalSeconds = null;
      this.datetimeParsed.setDecimalSeconds(null);
      this.resetTimezone();
      this.handlerContext.changeValue(this.component, this.datetimeParsed.toStorageRepresentation());
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
      this.handlerContext.changeValue(this.component, this.datetimeParsed.toStorageRepresentation());
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

  static fromStorageRepresentation(storedDateStr: string, ampm: boolean): DatetimeRepresentation {
    const that = new DatetimeRepresentation();
    const datePatternStr = '^\\d{4}\\' + DatetimeRepresentation.DATE_SEPARATOR + '\\d{2}\\' + DatetimeRepresentation.DATE_SEPARATOR + '\\d{2}';
    const datePattern = new RegExp(datePatternStr);
    const dateStr = storedDateStr.match(datePattern);

    if (dateStr && dateStr.length > 0) {
      that.dateIsSet = true;
      that.setDate(moment(dateStr[0], DatetimeRepresentation.DATE_STORED_FORMAT));
    }
    const timePatternStr = '(\\d{2}\\' + DatetimeRepresentation.TIME_SEPARATOR + '\\d{2}\\' + DatetimeRepresentation.TIME_SEPARATOR + '\\d{2})(\\.[\\d\\.]+)*';
    const timePattern = new RegExp(timePatternStr);
    const timeStr = storedDateStr.match(timePattern);

    if (timeStr && timeStr.length > 1) {
      that.setAMPM(ampm);
      const timeArr = timeStr[1].split(DatetimeRepresentation.TIME_SEPARATOR);
      that.setHours(+timeArr[0]);
      that.setMinutes(+timeArr[1]);
      that.setSeconds(+timeArr[2]);

      if (timeStr.length > 2 && timeStr[2]) {
        that.setDecimalSeconds(+timeStr[2].substring(1));
      }
      const timezonePatternStr = 'Z|[\\-\\+]{1}\\d{2}\\' + DatetimeRepresentation.TIME_SEPARATOR + '\\d{2}$';
      const timezonePattern = new RegExp(timezonePatternStr);
      const timezoneStr = storedDateStr.match(timezonePattern);

      if (timezoneStr && timezoneStr.length > 0) {
        const timezone = TimezonePickerComponent.AVAILABLE_TIMEZONES.find(z => z.id === timezoneStr[0]);
        that.setTimezone(timezone);
      }
    }
    return that;
  }

  static regexIndexOf(text, re, i): number {
    const indexInSuffix = text.slice(i).search(re);
    return indexInSuffix < 0 ? indexInSuffix : indexInSuffix + i;
  }

  static indexOfEnd(sourceStr, matchStr): number {
    const io = sourceStr.indexOf(matchStr);
    return io === -1 ? -1 : io + matchStr.length;
  }

  setDate(dateIn: Moment): void {
    this.dateIsSet = true;
    this.year = dateIn.year().toLocaleString().replace(/,/,'');
    this.month = this.stringify((dateIn.month() + 1).toLocaleString());
    this.day = this.stringify(dateIn.date().toLocaleString());
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

  setDecimalSeconds(decSecondsIn: number): void {
    this.timeIsSet = true;

    if (decSecondsIn == null) {
      this.decimalSeconds = '';
    } else {
      this.decimalSeconds = decSecondsIn.toString();
    }
  }

  setTimezone(timezoneIn: TZone): void {
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
      m.set({year: +this.year, month: +this.month - 1, date: +this.day});
      formatArr.push(DatePickerComponent.YEAR_MONTH_DAY_FORMAT);
    }

    if (this.timeIsSet) {
      m.set({hour: +this.hours, minute: +this.minutes, second: +this.seconds});

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

  toStorageRepresentation(): string {
    let dateStr = '';

    if (this.dateIsSet) {
      dateStr += this.year + DatetimeRepresentation.DATE_SEPARATOR +
        this.month + DatetimeRepresentation.DATE_SEPARATOR +
        this.day;
    }

    if (this.timeIsSet) {
      if (this.dateIsSet) {
        dateStr += DatetimeRepresentation.DATE_TIME_SEPARATOR;
      }
      dateStr += this.hours + DatetimeRepresentation.TIME_SEPARATOR +
        this.minutes + DatetimeRepresentation.TIME_SEPARATOR +
        this.seconds;

      if (this.decimalSeconds.length > 0) {
        dateStr += DatetimeRepresentation.TIME_DECIMAL_SECOND_SEPARATOR +
          this.decimalSeconds;
      }
    }

    if (this.timezoneIsSet) {
      dateStr += this.timezoneOffset;
    }
    return dateStr;
  }

  toString(): string {
    return this.toStorageRepresentation();
  }

  private stringify(valIn: any): string {
    let str = valIn.toString();
    if (valIn < 10) {
      str = '0' + str;
    }
    return str;
  }

}
