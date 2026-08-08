import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ValidatorFn, Validators } from '@angular/forms';
import { DateAdapter } from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';

// One import, not the `_rollupMoment || _moment` pair this used to carry.
//
// That pattern is from Material's own datepicker guide, written when a project
// might be built by a bundler that synthesised a default export for a CommonJS
// module or by one that did not, so it took whichever it was given. CEE is built
// by the Angular CLI through esbuild, which does synthesise it, so the fallback
// arm was never the one taken.
//
// TypeScript 6.0 is what forced the question: a namespace import is not callable,
// so `_rollupMoment || _moment` types as a union with one non-callable arm and
// `moment()` stops compiling. Keeping both arms would mean suppressing that,
// which would be pretending the dead arm is live.
import moment, { Moment } from 'moment';
import { CustomDateAdapter } from '../../service/date-time/custom-date-adapter';
import { DateTimeService } from '../../service/date-time/date-time.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { Subscription } from 'rxjs';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';

@Component({
  selector: 'app-date-picker',
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss'],
  providers: [
    // DateTimeService is added as a provider to allow it
    // to be injected as a new instance per component, rather
    // than a Singleton instance
    DateTimeService,
    CustomDateAdapter, // so we could inject services to 'CustomDateAdapter'
    { provide: DateAdapter, useClass: CustomDateAdapter }, // Parse MatDatePicker format
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class DatePickerComponent implements OnInit {
  static readonly YEAR_FORMAT = 'YYYY';
  static readonly YEAR_MONTH_FORMAT = 'MM/YYYY';
  static readonly YEAR_MONTH_DAY_FORMAT = 'MM/DD/YYYY';
  yearFormat = DatePickerComponent.YEAR_FORMAT;
  yearMonthFormat = DatePickerComponent.YEAR_MONTH_FORMAT;
  yearMonthDayFormat = DatePickerComponent.YEAR_MONTH_DAY_FORMAT;

  @Input() dateMonthYear: FormControl;
  @Input() dateFormat = DatePickerComponent.YEAR_FORMAT;
  @Input() required: boolean;
  @Output() dateChangedEvent = new EventEmitter<Moment>();
  private userPreferencesService: UserPreferencesService;
  private readOnlyModeSubscription: Subscription;
  readOnlyMode: boolean;

  public constructor(
    private _dateTimeService: DateTimeService,
    userPreferenceService: UserPreferencesService,
  ) {
    this.userPreferencesService = userPreferenceService;
  }

  public ngOnInit(): void {
    this.readOnlyModeSubscription = this.userPreferencesService.readOnlyMode$.subscribe((mode) => {
      this.readOnlyMode = mode;
    });
    const validators: ValidatorFn[] = [];
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
    if (this.required) {
      validators.push(Validators.required);
    }
    this.dateMonthYear = new FormControl(null, validators);
  }

  chosenYearHandler(normalizedYear: Moment, datepicker: MatDatepicker<Moment>): void {
    if (this.dateMonthYear.value == null) {
      this.dateMonthYear.setValue(moment());
    }
    const ctrlValue = this.dateMonthYear.value;
    ctrlValue.year(normalizedYear.year());
    this.dateMonthYear.setValue(ctrlValue);
    if (this.dateFormat === this.yearFormat) {
      datepicker.close();
      this.dateChangedEvent.emit(this.dateMonthYear.value);
    }
  }

  chosenMonthHandler(normalizedMonth: Moment, datepicker: MatDatepicker<Moment>): void {
    const ctrlValue = this.dateMonthYear.value;
    ctrlValue.month(normalizedMonth.month());
    this.dateMonthYear.setValue(ctrlValue);

    if (this.dateFormat === this.yearMonthFormat) {
      datepicker.close();
    }
    this.dateChangedEvent.emit(this.dateMonthYear.value);
  }

  chosenDateHandler(event: MatDatepickerInputEvent<Moment>): void {
    if (event) {
      this.dateChangedEvent.emit(event.value);
    }
  }
}
