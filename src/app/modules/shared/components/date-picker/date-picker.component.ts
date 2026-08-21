import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  DestroyRef,
  OnInit,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { DateAdapter } from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';
import { CustomDateAdapter } from '../../service/date-time/custom-date-adapter';
import { DateTimeService } from '../../service/date-time/date-time.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
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

  /**
   * The shape of an acceptable date, for the box to state while read-only.
   *
   * The clock beside it already labels its own boxes `HH`, `MM` and `SS`; the date box labelled
   * nothing, so a year-granularity field and a full date looked identical when both were empty. The
   * granularity decides how much of the notation applies — a month field says `YYYY-MM` and stops.
   */
  get dateNotation(): string {
    if (!this.readOnlyMode) {
      return '';
    }
    if (this.dateFormat === DatePickerComponent.YEAR_FORMAT) {
      return 'YYYY';
    }
    // Hyphens, as ISO 8601 and the stored `xsd:date` both write them, so the notation is the literal
    // shape of an acceptable value rather than a pattern of its own.
    return this.dateFormat === DatePickerComponent.YEAR_MONTH_FORMAT ? 'YYYY-MM' : 'YYYY-MM-DD';
  }
  yearMonthFormat = DatePickerComponent.YEAR_MONTH_FORMAT;
  yearMonthDayFormat = DatePickerComponent.YEAR_MONTH_DAY_FORMAT;

  @Input({ required: true }) dateMonthYear!: FormControl<Date | null>;
  @Input() dateFormat = DatePickerComponent.YEAR_FORMAT;
  @Input() required = false;
  @Output() dateChangedEvent = new EventEmitter<Date>();
  private userPreferencesService: UserPreferencesService;
  readOnlyMode = false;

  public constructor(
    private _dateTimeService: DateTimeService,
    userPreferenceService: UserPreferencesService,
    private elementRef: ElementRef<HTMLElement>,
    private readonly destroyRef: DestroyRef,
  ) {
    this.userPreferencesService = userPreferenceService;
  }

  public ngOnInit(): void {
    this.userPreferencesService.readOnlyMode$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((mode) => {
      this.readOnlyMode = mode;
    });
    this._dateTimeService.format = this.dateFormat;
    if (this.required) {
      this.dateMonthYear.addValidators(Validators.required);
      this.dateMonthYear.updateValueAndValidity({ emitEvent: false });
    }
  }

  chosenYearHandler(normalizedYear: Date, datepicker: MatDatepicker<Date>): void {
    const current = this.dateMonthYear.value ?? new Date();
    const month = this.dateFormat === this.yearFormat ? 0 : current.getMonth();
    const next = DatePickerComponent.localDate(normalizedYear.getFullYear(), month, 1);
    this.dateMonthYear.setValue(next);
    if (this.dateFormat === this.yearFormat) {
      datepicker.close();
      this.dateChangedEvent.emit(next);
    }
  }

  chosenMonthHandler(normalizedMonth: Date, datepicker: MatDatepicker<Date>): void {
    const current = this.dateMonthYear.value ?? normalizedMonth;
    const next = DatePickerComponent.localDate(current.getFullYear(), normalizedMonth.getMonth(), 1);
    this.dateMonthYear.setValue(next);
    if (this.dateFormat === this.yearMonthFormat) {
      datepicker.close();
    }
    this.dateChangedEvent.emit(next);
  }

  chosenDateHandler(event: MatDatepickerInputEvent<Date>): void {
    if (event.value !== null) {
      this.dateChangedEvent.emit(event.value);
    }
  }

  /** Restore the toggle only when focus did not move out of the closing calendar. */
  datepickerClosed(): void {
    const root = this.elementRef.nativeElement.getRootNode();
    const closedFrom = DatePickerComponent.activeElement(root);
    if (closedFrom instanceof HTMLElement && closedFrom.closest('.cdk-overlay-container') === null) {
      return;
    }

    queueMicrotask(() => {
      const active = DatePickerComponent.activeElement(root);
      if (active instanceof HTMLElement && active.isConnected && active !== closedFrom) {
        return;
      }
      this.elementRef.nativeElement.querySelector<HTMLButtonElement>('mat-datepicker-toggle button')?.focus();
    });
  }

  private static activeElement(root: Node): Element | null {
    return root instanceof Document || root instanceof ShadowRoot ? root.activeElement : null;
  }

  private static localDate(year: number, month: number, day: number): Date {
    const value = new Date(0);
    value.setHours(0, 0, 0, 0);
    value.setFullYear(year, month, day);
    return value;
  }
}
