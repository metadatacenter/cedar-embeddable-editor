import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormControl} from '@angular/forms';
import {DateAdapter} from '@angular/material/core';
import {MatDatepicker} from '@angular/material/datepicker';

// Depending on whether rollup is used, moment needs to be imported differently.
// Since Moment.js doesn't have a default export, we normally need to import using the `* as`
// syntax. However, rollup creates a synthetic default module and we thus need to import it using
// the `default as` syntax.
import * as _moment from 'moment';
// tslint:disable-next-line:no-duplicate-imports
import {default as _rollupMoment, Moment} from 'moment';
import {CustomDateAdapter} from '../../service/date-time/custom-date-adapter';
import {DateTimeService} from '../../service/date-time/date-time.service';

const moment = _rollupMoment || _moment;

@Component({
  selector: 'app-date-picker',
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss'],
  providers: [
    CustomDateAdapter, // so we could inject services to 'CustomDateAdapter'
    {provide: DateAdapter, useClass: CustomDateAdapter} // Parse MatDatePicker format
  ]
})

export class DatePickerComponent implements OnInit {
  static readonly YEAR_FORMAT = 'YYYY';
  static readonly YEAR_MONTH_FORMAT = 'MM/YYYY';
  static readonly YEAR_MONTH_DAY_FORMAT = 'MM/DD/YYYY';
  yearFormat = DatePickerComponent.YEAR_FORMAT;
  yearMonthFormat = DatePickerComponent.YEAR_MONTH_FORMAT;
  yearMonthDayFormat = DatePickerComponent.YEAR_MONTH_DAY_FORMAT;
  dateMonthYear: FormControl;

  @Input() dateFormat = DatePickerComponent.YEAR_FORMAT;
  @Output() dateChangedEvent = new EventEmitter<Moment>();


  public constructor(private _dateTimeService: DateTimeService) {
  }

  public ngOnInit(): void {
    this._dateTimeService.format = this.dateFormat;
    const m = moment();

    switch (this.dateFormat) {
      case this.yearMonthFormat:
        m.set('date', 1);
        break;
      case this.yearFormat:
        m.set('date', 1);
        m.set('month', 0);
        break;
    }
    this.dateMonthYear = new FormControl(m);
    this.dateChangedEvent.emit(this.dateMonthYear.value);
  }

  chosenYearHandler(normalizedYear: Moment, datepicker: MatDatepicker<Moment>): void {
    this._dateTimeService.format = this.dateFormat;
    const ctrlValue = this.dateMonthYear.value;
    ctrlValue.year(normalizedYear.year());
    this.dateMonthYear.setValue(ctrlValue);

    if (this.dateFormat === this.yearFormat) {
      datepicker.close();
      this.dateChangedEvent.emit(this.dateMonthYear.value);
    }
  }

  chosenMonthHandler(normalizedMonth: Moment, datepicker: MatDatepicker<Moment>): void {
    this._dateTimeService.format = this.dateFormat;
    const ctrlValue = this.dateMonthYear.value;
    ctrlValue.month(normalizedMonth.month());
    this.dateMonthYear.setValue(ctrlValue);

    if (this.dateFormat === this.yearMonthFormat) {
      datepicker.close();
    }
    this.dateChangedEvent.emit(this.dateMonthYear.value);
  }

  chosenDateHandler(event): void {
    this._dateTimeService.format = this.dateFormat;

    if (event) {
      this.dateChangedEvent.emit(event.value);
    }
  }
}
