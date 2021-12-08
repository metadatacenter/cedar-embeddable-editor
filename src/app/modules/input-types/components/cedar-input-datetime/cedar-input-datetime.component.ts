import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {FieldComponent} from '../../../shared/models/component/field-component.model';
import {FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {ComponentDataService} from '../../../shared/service/component-data.service';
import {CedarUIComponent} from '../../../shared/models/ui/cedar-ui-component.model';
import {ActiveComponentRegistryService} from '../../../shared/service/active-component-registry.service';
import {HandlerContext} from '../../../shared/util/handler-context';
import {DatePickerComponent} from '../../../shared/components/date-picker/date-picker.component';
import {Xsd} from '../../../shared/models/xsd.model';
import {Temporal} from '../../../shared/models/temporal.model';


import {Moment} from 'moment';



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
  datetimeValue: DatetimeRepresentation;

  @Input() handlerContext: HandlerContext;



  constructor(fb: FormBuilder, public cds: ComponentDataService, activeComponentRegistry: ActiveComponentRegistryService) {
    super();
    this.activeComponentRegistry = activeComponentRegistry;
    this.timePickerTime = new Date();
    // this.timePickerTime.setHours(0,0,0,0);
    this.datetimeValue = new DatetimeRepresentation();
  }

  ngOnInit(): void {
  }







  dateInputChanged(event): void {
    console.log('in cedar-input-datetime event:');
    console.log(event);
  }

  timeInputChanged(event): void {
    console.log(this.timePickerTime.getHours());
    console.log(this.timePickerTime.getMinutes());
    console.log(this.timePickerTime.getSeconds());
  }

  decimalSecondsChanged(event): void {
    console.log('dec seconds event: ' + event);
    console.log('dec seconds ngModel: ' + this.decimalSeconds);
  }

  timezoneInputChanged(event): void {
    console.log('timezone event: ' + JSON.stringify(event));
    console.log('timezone ngModel: ' + JSON.stringify(this.timezone));
    console.log('timezone type: ' + typeof this.timezone);
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






  @Input() set componentToRender(componentToRender: FieldComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerComponent(this.component, this);
  }


  setCurrentValue(currentValue: any): void {
  }

}


export class DatetimeRepresentation {
  static readonly DATE_SEPARATOR = '-';
  static readonly DATE_TIME_SEPARATOR = 'T';

  dateIsSet: boolean;
  timeIsSet: boolean;
  timezoneIsSet: boolean;

  year: string;
  month: string;
  day: string;

  hours: string;
  minutes: string;
  seconds: string;

  timezone: string;


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

    this.timezone = '';
  }

  setYear(dateIn: Moment): void {
    this.dateIsSet = true;
    this.year = dateIn.year().toLocaleString();
  }

  setMonth(dateIn: Moment): void {
    this.dateIsSet = true;
    this.month = dateIn.month().toLocaleString();
  }

  setDay(dateIn: Moment): void {
    this.dateIsSet = true;
    this.day = dateIn.day().toLocaleString();
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

  setTimezone(timezoneIn: object): void {
    this.timezoneIsSet = true;
    const timezoneKey = 'timeValue';
    this.timezone = timezoneIn[timezoneKey];
  }

  private stringify(valIn: number): string {
    let str = valIn.toString();
    if (valIn < 10) {
      str = '0' + str;
    }
    return str;
  }

}
