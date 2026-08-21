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
  @Input() customPlaceholderText = 'Select UTC offset';

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
    if (!/^[+-](?:0\d|1[0-3]):[0-5]\d$|^[+-]14:00$/.test(offset)) {
      return null;
    }
    return (
      TimezonePickerComponent.AVAILABLE_TIMEZONES.find((zone) => zone.id === offset) ?? {
        id: offset,
        label: TimezonePickerComponent.labelFor(offset),
      }
    );
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
    const zone = this.ensureAvailable(offset ? TimezonePickerComponent.zoneForOffset(offset) : null);
    this.form.controls.timezone.setValue(zone, { emitEvent: false });
  }

  private applyGuessedZone(): void {
    if (this.getUserZone && this.form.controls.timezone.value === null) {
      this.form.controls.timezone.setValue(this.ensureAvailable(TimezonePickerComponent.guessedUserZone()));
    }
  }

  private ensureAvailable(zone: TZone | null): TZone | null {
    if (zone !== null && !this.timeZones.some((candidate) => candidate.id === zone.id)) {
      this.timeZones = [...this.timeZones, zone];
    }
    return zone;
  }
}
