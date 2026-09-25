import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  forwardRef,
  Input,
  OnChanges,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormControl, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { CedarTemporalValue } from '../../util/cedar-temporal-value';

/** A fixed UTC offset and its unambiguous display text. */
export interface TZone {
  readonly id: string;
  readonly label: string;
}

@Component({
  selector: 'app-timezone-picker',
  templateUrl: './timezone-picker.component.html',
  styleUrls: ['./timezone-picker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimezonePickerComponent),
      multi: true,
    },
  ],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class TimezonePickerComponent implements OnInit, OnChanges, ControlValueAccessor {
  /**
   * Fixed offsets CEE has historically accepted, now named for what they are.
   *
   * The old labels attached cities to offsets. That was misleading whenever a
   * city's daylight-saving rule changed: CEE stores `+05:30`, not an IANA zone
   * such as `Asia/Kolkata`. Keeping the same ids preserves stored values while
   * the labels make the storage semantics explicit.
   */
  static readonly AVAILABLE_TIMEZONES: readonly TZone[] = [
    '-12:00',
    '-11:00',
    '-10:00',
    '-09:30',
    '-09:00',
    '-08:00',
    '-07:00',
    '-06:00',
    '-05:00',
    '-04:30',
    '-04:00',
    '-03:30',
    '-03:00',
    '-02:30',
    '-02:00',
    '-01:00',
    'Z',
    '+01:00',
    '+02:00',
    '+03:00',
    '+03:30',
    '+04:00',
    '+04:30',
    '+05:00',
    '+05:30',
    '+05:45',
    '+06:00',
    '+06:30',
    '+07:00',
    '+08:00',
    '+08:45',
    '+09:00',
    '+09:30',
    '+10:00',
    '+10:30',
    '+11:00',
    '+11:30',
    '+12:00',
    '+12:45',
    '+13:00',
    '+13:45',
    '+14:00',
  ].map((id) => ({ id, label: TimezonePickerComponent.labelFor(id) }));

  @Input() getUserZone = false;
  @Input() customPlaceholderText = 'Timezone unspecified';

  readonly form = new FormGroup({
    timezone: new FormControl<TZone | null>(null),
  });
  timeZones: TZone[] = [...TimezonePickerComponent.AVAILABLE_TIMEZONES];
  readOnlyMode = false;

  private initialized = false;
  private propagateChange: (value: TZone | null) => void = () => {};
  private propagateTouched: () => void = () => {};

  constructor(
    private readonly userPreferencesService: UserPreferencesService,
    private readonly destroyRef: DestroyRef,
  ) {}

  static guessedUserZone(): TZone {
    // getTimezoneOffset has the inverse sign of an ISO 8601 offset.
    return TimezonePickerComponent.zoneForMinutes(-new Date().getTimezoneOffset());
  }

  static zoneForOffset(offset: string): TZone | null {
    if (offset === 'Z' || offset === '+00:00' || offset === '-00:00') {
      return TimezonePickerComponent.AVAILABLE_TIMEZONES.find((zone) => zone.id === 'Z') ?? null;
    }
    if (!CedarTemporalValue.isValidOffset(offset)) {
      return null;
    }
    return (
      TimezonePickerComponent.AVAILABLE_TIMEZONES.find((zone) => zone.id === offset) ?? {
        id: offset,
        label: TimezonePickerComponent.labelFor(offset),
      }
    );
  }

  /**
   * The zone to show for an offset a stored value carries, valid or not.
   *
   * An offset shaped `±HH:MM` but outside XML Schema's range, such as `+05:60`, is
   * kept as it stands so the control shows it and an edit writes it back unchanged.
   * Only a choice from the list or a clear replaces it. Anything else is not an
   * offset at all.
   */
  static zoneForStoredOffset(offset: string): TZone | null {
    const zone = TimezonePickerComponent.zoneForOffset(offset);
    if (zone !== null || !/^[+-]\d{2}:\d{2}$/.test(offset)) {
      return zone;
    }
    return { id: offset, label: TimezonePickerComponent.labelFor(offset) };
  }

  private static zoneForMinutes(totalMinutes: number): TZone {
    if (totalMinutes === 0) {
      return TimezonePickerComponent.zoneForOffset('Z')!;
    }
    const sign = totalMinutes < 0 ? '-' : '+';
    const absolute = Math.abs(totalMinutes);
    const hours = Math.floor(absolute / 60)
      .toString()
      .padStart(2, '0');
    const minutes = (absolute % 60).toString().padStart(2, '0');
    return TimezonePickerComponent.zoneForOffset(`${sign}${hours}:${minutes}`)!;
  }

  private static labelFor(offset: string): string {
    return offset === 'Z' ? 'UTC (Z)' : `UTC${offset}`;
  }

  ngOnInit(): void {
    this.initialized = true;
    this.userPreferencesService.readOnlyMode$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((mode) => {
      this.readOnlyMode = mode;
    });
    this.form.controls.timezone.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.propagateChange(value);
    });
    this.applyGuessedZone();
  }

  ngOnChanges(): void {
    if (this.initialized) {
      this.applyGuessedZone();
    }
  }

  /** Whether no zone in current use has this offset, so the list shows it only because a value holds it. */
  static isNonStandard(zone: TZone): boolean {
    return !TimezonePickerComponent.AVAILABLE_TIMEZONES.some((standard) => standard.id === zone.id);
  }

  /** Minutes east of UTC, the order the list is shown in. */
  private static minutesOf(zone: TZone): number {
    if (zone.id === 'Z') {
      return 0;
    }
    const sign = zone.id.startsWith('-') ? -1 : 1;
    const [hours, minutes] = zone.id.slice(1).split(':').map(Number);
    return sign * (hours * 60 + minutes);
  }

  /** Whether the offset is outside XML Schema's range, so the value holding it is invalid. */
  static isInvalid(zone: TZone): boolean {
    return !CedarTemporalValue.isValidOffset(zone.id);
  }

  isNonStandard(zone: TZone): boolean {
    return TimezonePickerComponent.isNonStandard(zone);
  }

  isInvalid(zone: TZone): boolean {
    return TimezonePickerComponent.isInvalid(zone);
  }

  compareZones(first: TZone | null, second: TZone | null): boolean {
    return first?.id === second?.id;
  }

  markTouched(): void {
    this.propagateTouched();
  }

  registerOnChange(fn: (value: TZone | null) => void): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.propagateTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    if (disabled) {
      this.form.controls.timezone.disable({ emitEvent: false });
    } else {
      this.form.controls.timezone.enable({ emitEvent: false });
    }
  }

  writeValue(value: string | TZone | null): void {
    const offset = typeof value === 'string' ? value : value?.id;
    const zone = this.ensureAvailable(offset ? TimezonePickerComponent.zoneForStoredOffset(offset) : null);
    this.form.controls.timezone.setValue(zone, { emitEvent: false });
  }

  private applyGuessedZone(): void {
    if (this.getUserZone && this.form.controls.timezone.value === null) {
      this.form.controls.timezone.setValue(this.ensureAvailable(TimezonePickerComponent.guessedUserZone()));
    }
  }

  private ensureAvailable(zone: TZone | null): TZone | null {
    if (zone !== null && !this.timeZones.some((candidate) => candidate.id === zone.id)) {
      this.timeZones = [...this.timeZones, zone].sort(
        (first, second) => TimezonePickerComponent.minutesOf(first) - TimezonePickerComponent.minutesOf(second),
      );
    }
    return zone;
  }
}
