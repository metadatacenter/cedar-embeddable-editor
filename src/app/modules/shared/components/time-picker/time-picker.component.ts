import {
  Component,
  DestroyRef,
  forwardRef,
  Input,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
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
  encapsulation: ViewEncapsulation.Emulated,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TimePickerComponent implements ControlValueAccessor, OnInit {
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
  /** Raw text remains unpadded until the user leaves the segment. */
  hourDraft = '';
  minuteDraft = '';
  secondDraft = '';
  /** The segment whose rejected edit was most recently restored on blur. */
  restoredSegment: 'hour' | 'minute' | 'second' | null = null;

  private invalidSegment: 'hour' | 'minute' | 'second' | null = null;
  private editingSegment: 'hour' | 'minute' | 'second' | null = null;
  private replaceOnNextKey: 'hour' | 'minute' | 'second' | null = null;

  /**
   * Not editable, for either of the two independent reasons it can be true.
   *
   * The widget is locked when the user has turned read-only mode on, and separately
   * when the form control bound to it is disabled. They were one field until Angular
   * 15, and that worked only by accident: `setDisabledState` used to be called only
   * for a control that was actually disabled, so the false it passes for an enabled
   * one never arrived to overwrite the preference. Angular 15 calls it on every
   * attach — `setUpControl`'s `callSetDisabledState` now defaults to `always`,
   * described in Angular's own source as fixing a bug — so an enabled control
   * immediately reset read-only mode to false and the editable boxes came back in a
   * form the user had locked.
   *
   * Keeping the two apart is the fix rather than restoring the old call behaviour
   * with `FormsModule.withConfig({ callSetDisabledState: 'whenDisabledForLegacyCode' })`,
   * which would leave one field with two writers still racing and would have to be
   * unpicked the day that option goes.
   */
  get readOnlyMode(): boolean {
    return this.readOnlyPreference || this.controlDisabled;
  }

  private readOnlyPreference = false;
  private controlDisabled = false;

  /**
   * The `Date` last written in, kept so a time edit does not move the day.
   *
   * The date half of a datetime field is a separate control writing to the same
   * stored representation.
   */
  private value: Date | null = null;

  private onChange: (value: Date) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private userPreferencesService: UserPreferencesService,
    private readonly destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.userPreferencesService.readOnlyMode$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((mode) => {
      this.readOnlyPreference = mode;
    });
  }

  // --- ControlValueAccessor -------------------------------------------------
  //
  // Implemented so `[(ngModel)]` keeps working: the widget above binds a `Date`
  // and listens for `ngModelChange`, exactly as it did with the dependency, so
  // swapping this in changed one element and no logic.

  writeValue(value: Date | null): void {
    const incoming = value ? new Date(value.getTime()) : null;
    this.value = incoming;
    const hour24 = this.value ? this.value.getHours() : 0;

    /*
     * `[(ngModel)]` and the parent temporal normalizer both write an emitted
     * value back through this method. Let that update inactive segments, but
     * never replace the segment currently receiving keystrokes. Otherwise the
     * first digit is padded before the second digit arrives.
     */
    if (this.editingSegment !== 'hour') {
      if (this.enableMeridian) {
        const shown = ClockTime.toTwelveHour(hour24);
        this.hour = shown.hour;
        this.meridian = shown.meridian;
      } else {
        this.hour = hour24;
      }
    }
    if (this.editingSegment !== 'minute') {
      this.minute = this.value ? this.value.getMinutes() : 0;
    }
    if (this.editingSegment !== 'second') {
      this.second = this.value ? this.value.getSeconds() : 0;
    }
    if (this.editingSegment === null) {
      this.invalidSegment = null;
      this.restoredSegment = null;
      this.syncDrafts();
    }
  }

  registerOnChange(fn: (value: Date) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
  }

  // --- editing --------------------------------------------------------------

  /** Accept a typed hour only when it is valid on the face being shown. */
  hourChanged(raw: unknown): void {
    this.replaceOnNextKey = null;
    this.hourDraft = String(raw ?? '');
    const value = TimePickerComponent.typedSegment(raw, this.enableMeridian ? 1 : 0, this.enableMeridian ? 12 : 23);
    if (value === null) {
      this.invalidSegment = 'hour';
      return;
    }
    this.hour = value;
    this.acceptSegment('hour');
    this.emit();
  }

  minuteChanged(raw: unknown): void {
    this.replaceOnNextKey = null;
    this.minuteDraft = String(raw ?? '');
    const value = TimePickerComponent.typedSegment(raw, 0, 59);
    if (value === null) {
      this.invalidSegment = 'minute';
      return;
    }
    this.minute = value;
    this.acceptSegment('minute');
    this.emit();
  }

  secondChanged(raw: unknown): void {
    this.replaceOnNextKey = null;
    this.secondDraft = String(raw ?? '');
    const value = TimePickerComponent.typedSegment(raw, 0, 59);
    if (value === null) {
      this.invalidSegment = 'second';
      return;
    }
    this.second = value;
    this.acceptSegment('second');
    this.emit();
  }

  /**
   * Which half of the day the face is showing.
   *
   * Reported only when there is a time for it to be about. A meridian expresses
   * something *about* a time and is not one, so toggling it on an empty clock
   * used to build an instant out of `new Date()` and report it — a field nobody
   * had entered a time into recorded midnight. The choice is still remembered,
   * so the first hour typed afterwards lands in the half the user picked.
   */
  meridianChanged(meridian: Meridian): void {
    this.meridian = meridian;
    if (this.hasValue) {
      this.emit();
    }
  }

  /** Step a focused clock segment from its ArrowUp or ArrowDown key. */
  step(field: 'hour' | 'minute' | 'second', by: number): void {
    if (this.readOnlyMode) {
      return;
    }
    if (field === 'hour') {
      this.hour = this.enableMeridian ? ClockTime.wrap(this.hour + by, 1, 12) : ClockTime.wrap(this.hour + by, 0, 23);
    } else if (field === 'minute') {
      this.minute = ClockTime.wrap(this.minute + by, 0, 59);
    } else {
      this.second = ClockTime.wrap(this.second + by, 0, 59);
    }
    this.acceptSegment(field);
    this.setDraft(field, this.segmentText(field));
    this.emit();
  }

  /** Keep clock stepping available from the keyboard without permanent button towers. */
  segmentKeydown(event: KeyboardEvent, field: 'hour' | 'minute' | 'second'): void {
    if (/^\d$/.test(event.key) && this.replaceOnNextKey === field) {
      event.preventDefault();
      this.replaceOnNextKey = null;
      if (field === 'hour') {
        this.hourChanged(event.key);
      } else if (field === 'minute') {
        this.minuteChanged(event.key);
      } else {
        this.secondChanged(event.key);
      }
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    this.replaceOnNextKey = null;
    this.step(field, event.key === 'ArrowUp' ? 1 : -1);
  }

  segmentFocus(event: FocusEvent, field: 'hour' | 'minute' | 'second'): void {
    this.editingSegment = field;
    this.replaceOnNextKey = field;
    (event.target as HTMLInputElement).select();
  }

  /**
   * Reject an out-of-range typed segment on blur and restore the last stored
   * value. Arrow-key stepping still wraps because stepping a clock and entering
   * a number are different actions: `23 + ArrowUp` means midnight, while typing
   * `25` should never silently become `01`.
   */
  segmentBlur(event: FocusEvent, field: 'hour' | 'minute' | 'second'): void {
    const input = event.target as HTMLInputElement;
    const canonical = this.hasValue ? this.segmentText(field) : '';
    if (this.invalidSegment === field) {
      this.invalidSegment = null;
      this.restoredSegment = field;
    }
    this.setDraft(field, canonical);
    input.value = canonical;
    const next = event.relatedTarget;
    const movingWithinClock = next instanceof HTMLElement && next.classList.contains('cee-time-segment');
    if (!movingWithinClock && this.editingSegment === field) {
      this.editingSegment = null;
      // Leaving the clock, every box shows what the instant holds. The model
      // wrote the other segments back while this one was being typed into — a
      // typed hour stores `09:00:00` — and `writeValue` rightly leaves drafts
      // alone during an edit, so `MM` and `SS` stood over a stored `00` until
      // something else wrote the value in again. A placeholder is the one thing
      // that must not stand over a value.
      this.syncDrafts();
    }
    if (this.replaceOnNextKey === field) {
      this.replaceOnNextKey = null;
    }
    this.onTouched();
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

  get hasValue(): boolean {
    return this.value !== null;
  }

  private static pad(value: number): string {
    return value.toString().padStart(2, '0');
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

  private acceptSegment(field: 'hour' | 'minute' | 'second'): void {
    if (this.invalidSegment === field) {
      this.invalidSegment = null;
    }
    this.restoredSegment = null;
  }

  private segmentText(field: 'hour' | 'minute' | 'second'): string {
    if (field === 'hour') {
      return this.hourText;
    }
    return field === 'minute' ? this.minuteText : this.secondText;
  }

  private syncDrafts(): void {
    this.hourDraft = this.hasValue ? this.hourText : '';
    this.minuteDraft = this.hasValue ? this.minuteText : '';
    this.secondDraft = this.hasValue ? this.secondText : '';
  }

  private setDraft(field: 'hour' | 'minute' | 'second', value: string): void {
    if (field === 'hour') {
      this.hourDraft = value;
    } else if (field === 'minute') {
      this.minuteDraft = value;
    } else {
      this.secondDraft = value;
    }
  }

  private static typedSegment(raw: unknown, min: number, max: number): number | null {
    const text = String(raw ?? '');
    if (!/^\d{1,2}$/.test(text)) {
      return null;
    }
    const parsed = Number.parseInt(text, 10);
    return parsed >= min && parsed <= max ? parsed : null;
  }
}
