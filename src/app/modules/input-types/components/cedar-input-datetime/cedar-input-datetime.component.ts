import {ChangeDetectorRef, Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';
import {DatePickerComponent} from '../../../shared/components/date-picker/date-picker.component';
import {Xsd} from '../../../shared/models/xsd.model';
import {Temporal} from '../../../shared/models/temporal.model';
import moment, {Moment} from 'moment';
import {TimezonePickerComponent} from '../../../shared/components/timezone-picker/timezone-picker.component';
// import {Moment} from 'moment';
// import * as moment from 'moment-timezone';


@Component({
  selector: 'app-cedar-input-datetime',
  templateUrl: './cedar-input-datetime.component.html',
  styleUrls: ['./cedar-input-datetime.component.scss'],
  encapsulation: ViewEncapsulation.None,
})

export class CedarInputDatetimeComponent extends CedarUIComponent implements OnInit {

  readonly YEAR_FORMAT = DatePickerComponent.YEAR_FORMAT;
  readonly YEAR_MONTH_FORMAT = DatePickerComponent.YEAR_MONTH_FORMAT;
  readonly YEAR_MONTH_DAY_FORMAT = DatePickerComponent.YEAR_MONTH_DAY_FORMAT;

  component: FieldComponent;
  activeComponentRegistry: ActiveComponentRegistryService;

  timePickerTime: Date;
  decimalSeconds: number;
  timezone: object;
  datetimeParsed: DatetimeRepresentation;

  @Input() handlerContext: HandlerContext;


  constructor(fb: FormBuilder, public cds: ComponentDataService,
              activeComponentRegistry: ActiveComponentRegistryService, private cdr: ChangeDetectorRef) {
    super();
    this.activeComponentRegistry = activeComponentRegistry;
    this.timePickerTime = new Date();
    // this.timePickerTime.setHours(0,0,0,0);
  }

  ngOnInit(): void {
    this.datetimeParsed = new DatetimeRepresentation();
    this.cdr.detectChanges();
  }

  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }

  dateInputChanged(event): void {
    this.datetimeParsed.setDate(event);
    // this.cdr.detectChanges();
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
    }


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
    const dateStr = storedDateStr.substring(0, storedDateStr.indexOf(DatetimeRepresentation.DATE_TIME_SEPARATOR));
    const timeStr = storedDateStr.substring(storedDateStr.indexOf(DatetimeRepresentation.DATE_TIME_SEPARATOR) + 1);

    if (dateStr) {
      that.dateIsSet = true;
      that.setDate(moment(dateStr, DatetimeRepresentation.DATE_STORED_FORMAT));
    }

    if (timeStr) {
      that.setAMPM(ampm);
      const timeArr = timeStr.substring(0, 8).split(DatetimeRepresentation.TIME_SEPARATOR);
      that.setHours(+timeArr[0]);
      that.setMinutes(+timeArr[1]);
      that.setSeconds(+timeArr[2]);

      const decSecTimezoneStr = timeStr.substring(8);

      if (decSecTimezoneStr) {
        let decSecStr = '';
        let timezoneStr = '';

        const tzRegex = /\-|\+|Z/;
        const ind = DatetimeRepresentation.regexIndexOf(decSecTimezoneStr, tzRegex, 0);

        // yes dec seconds, no timezone
        if (ind < 0) {
          decSecStr = decSecTimezoneStr.substring(1);
        }
        // no dec seconds, yes timezone
        else if (ind === 0) {
          timezoneStr = decSecTimezoneStr;
        }
        // yes dec secons, yes timezone
        else {
          decSecStr = decSecTimezoneStr.substring(1, ind);
          timezoneStr = decSecTimezoneStr.substring(ind);
        }

        if (decSecStr) {
          that.setDecimalSeconds(+decSecStr);
        }

        if (timezoneStr) {
          const timezone = TimezonePickerComponent.AVAILABLE_TIMEZONES.find(z => z.id === timezoneStr);
          that.setTimezone(timezone);
        }
      }
    }

    console.log('date str: ' + dateStr);
    console.log('time str: ' + timeStr);
    console.log(JSON.stringify(that));

    return that;
  }

  static regexIndexOf(text, re, i): number {
    const indexInSuffix = text.slice(i).search(re);
    return indexInSuffix < 0 ? indexInSuffix : indexInSuffix + i;
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

  setTimezone(timezoneIn: object): void {
    this.timezoneIsSet = true;
    const timezoneNameKey = 'label';
    const timezoneOffsetKey = 'id';
    this.timezoneName = timezoneIn[timezoneNameKey];
    this.timezoneOffset = timezoneIn[timezoneOffsetKey];
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
