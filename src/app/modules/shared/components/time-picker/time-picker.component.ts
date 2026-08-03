import { Component, forwardRef, Input, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { ClockTime, Meridian } from '../../util/clock-time';

/**
 * CEE's own time picker.
 *
 * Replaces `ngx-mat-timepicker` from `@angular-material-components/datetime-picker`,
 * which peers Angular 16 and nothing later — one element in one template, and it
 * capped the whole framework upgrade.
 *
 * The obvious replacement, `@ng-matero/extensions`, supports no seconds at all.
 * That is not a UX difference: CEDAR's temporal granularity runs
 * `year → month → day → hour → minute → second → decimalSecond`, and measuring
 * both artifact corpora, second-precision is the *second most used* granularity
 * after `day` — four templates use `second`, three use `decimalSecond`, ahead of
 * `year`. Adopting it would have been a functional regression against the model.
 *
 * So this is written against CEDAR's granularity model rather than adapted to
 * someone else's, which is the reason to own it. The four things the field can
 * ask for map onto the four inputs below, and each comes from one predicate that
 * already existed in `cedar-input-datetime.component.ts`.
 *
 * **The value is always a 24-hour `Date`.** `_ui.inputTimeFormat: 12h` changes
 * what this shows, never what it emits — CEDAR stores `HH:mm:ss` on a 24-hour
 * clock regardless. The conversion is in `ClockTime`, with tests, because an
 * off-by-twelve here writes the wrong instant into someone's metadata and both
 * values look perfectly well-formed.
 */
@Component({
  selector: 'app-time-picker',
  templateUrl: './time-picker.component.html',
  styleUrls: ['./time-picker.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
})
export class TimePickerComponent implements ControlValueAccessor, OnInit, OnDestroy {
  /** Show a 12-hour face with an AM/PM control. Display only. */
  @Input() enableMeridian = false;
  /** Hour-only precision: the field's granularity stops at the hour. */
  @Input() disableMinute = false;
  /** Show a seconds box. */
  @Input() showSeconds = false;

  /** What the boxes hold. Hour is 1–12 when `enableMeridian`, else 0–23. */
  hour = 0;
  minute = 0;
  second = 0;
  meridian: Meridian = 'AM';

  readOnlyMode = false;

  /**
   * The `Date` last written in, kept so a time edit does not move the day.
   *
   * The date half of a datetime field is a separate control writing to the same
   * stored representation.
   */
  private value: Date | null = null;
  private readOnlyModeSubscription: Subscription;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onChange: (value: Date) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onTouched: () => void = () => {};

  constructor(private userPreferencesService: UserPreferencesService) {}

  ngOnInit(): void {
    this.readOnlyModeSubscription = this.userPreferencesService.readOnlyMode$.subscribe((mode) => {
      this.readOnlyMode = mode;
    });
  }

  ngOnDestroy(): void {
    this.readOnlyModeSubscription?.unsubscribe();
  }

  // --- ControlValueAccessor -------------------------------------------------
  //
  // Implemented so `[(ngModel)]` keeps working: the widget above binds a `Date`
  // and listens for `ngModelChange`, exactly as it did with the dependency, so
  // swapping this in changed one element and no logic.

  writeValue(value: Date | null): void {
    this.value = value ? new Date(value.getTime()) : null;
    const hour24 = this.value ? this.value.getHours() : 0;

    if (this.enableMeridian) {
      const shown = ClockTime.toTwelveHour(hour24);
      this.hour = shown.hour;
      this.meridian = shown.meridian;
    } else {
      this.hour = hour24;
    }
    this.minute = this.value ? this.value.getMinutes() : 0;
    this.second = this.value ? this.value.getSeconds() : 0;
  }

  registerOnChange(fn: (value: Date) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readOnlyMode = isDisabled;
  }

  // --- editing --------------------------------------------------------------

  /** The hour box, wrapped into whichever face is showing. */
  hourChanged(raw: unknown): void {
    this.hour = this.enableMeridian
      ? ClockTime.wrap(TimePickerComponent.toNumber(raw), 1, 12)
      : ClockTime.wrap(TimePickerComponent.toNumber(raw), 0, 23);
    this.emit();
  }

  minuteChanged(raw: unknown): void {
    this.minute = ClockTime.wrap(TimePickerComponent.toNumber(raw), 0, 59);
    this.emit();
  }

  secondChanged(raw: unknown): void {
    this.second = ClockTime.wrap(TimePickerComponent.toNumber(raw), 0, 59);
    this.emit();
  }

  meridianChanged(meridian: Meridian): void {
    this.meridian = meridian;
    this.emit();
  }

  /** Step a field, which is what the spinner buttons do. */
  step(field: 'hour' | 'minute' | 'second', by: number): void {
    if (this.readOnlyMode) {
      return;
    }
    if (field === 'hour') {
      this.hourChanged(this.hour + by);
    } else if (field === 'minute') {
      this.minuteChanged(this.minute + by);
    } else {
      this.secondChanged(this.second + by);
    }
  }

  toggleMeridian(): void {
    if (!this.readOnlyMode) {
      this.meridianChanged(this.meridian === 'AM' ? 'PM' : 'AM');
    }
  }

  /**
   * The hour as the box shows it.
   *
   * Zero-padded on a 24-hour face — `01`, which is what a clock reads and what
   * the dependency this replaced displayed — and unpadded on a 12-hour one,
   * because `02:30 PM` is not how anyone writes half past two.
   *
   * Padding is why the boxes are text inputs rather than `type="number"`: a
   * numeric input cannot hold a leading zero. `inputmode="numeric"` still asks
   * for a numeric keypad, and the parsing below already takes strings.
   */
  get hourText(): string {
    return this.enableMeridian ? this.hour.toString() : TimePickerComponent.pad(this.hour);
  }

  get minuteText(): string {
    return TimePickerComponent.pad(this.minute);
  }

  get secondText(): string {
    return TimePickerComponent.pad(this.second);
  }

  private static pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  /** What a read-only field shows instead of boxes. */
  get displayValue(): string {
    const pad = TimePickerComponent.pad;
    let text = this.enableMeridian ? this.hour.toString() : pad(this.hour);
    if (!this.disableMinute) {
      text += `:${pad(this.minute)}`;
      if (this.showSeconds) {
        text += `:${pad(this.second)}`;
      }
    }
    return this.enableMeridian ? `${text} ${this.meridian}` : text;
  }

  private emit(): void {
    const hour24 = this.enableMeridian ? ClockTime.toTwentyFourHour(this.hour, this.meridian) : this.hour;
    // A field with hour-only granularity stores no minutes or seconds, and the
    // boxes for them are not on screen — so they must not leak a stale value
    // into the instant either.
    const minute = this.disableMinute ? 0 : this.minute;
    const second = this.disableMinute || !this.showSeconds ? 0 : this.second;

    this.value = ClockTime.withTime(this.value, hour24, minute, second);
    this.onTouched();
    this.onChange(this.value);
  }

  private static toNumber(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }
    const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
}
