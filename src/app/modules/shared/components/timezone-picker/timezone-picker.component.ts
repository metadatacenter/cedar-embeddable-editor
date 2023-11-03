import {
  AfterViewInit,
  Component,
  forwardRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewEncapsulation,
} from '@angular/core';
import * as momentZone from 'moment-timezone';
import { ControlValueAccessor, FormBuilder, FormGroup, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export class TZone {
  id: string;
  label: string;
}

export interface SelectConfig {
  appearance: 'underline' | 'outline';
  appendTo: string;
  clearOnBackspace: boolean;
  closeOnSelect: boolean;
  dropdownPosition: 'auto' | 'bottom' | 'top';
  hideSelected: boolean;
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
  encapsulation: ViewEncapsulation.None,
})
export class TimezonePickerComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges, ControlValueAccessor {
  static readonly AVAILABLE_TIMEZONES = [
    { id: '-12:00', label: '(GMT -12:00) Eniwetok, Kwajalein' },
    { id: '-11:00', label: '(GMT -11:00) Midway Island, Samoa' },
    { id: '-10:00', label: '(GMT -10:00) Hawaii' },
    { id: '-09:30', label: '(GMT -9:30) Taiohae' },
    { id: '-09:00', label: '(GMT -9:00) Alaska' },
    { id: '-08:00', label: '(GMT -8:00) Pacific Time (US & Canada)' },
    { id: '-07:00', label: '(GMT -7:00) Mountain Time (US & Canada)' },
    { id: '-06:00', label: '(GMT -6:00) Central Time (US & Canada), Mexico City' },
    { id: '-05:00', label: '(GMT -5:00) Eastern Time (US & Canada), Bogota, Lima' },
    { id: '-04:30', label: '(GMT -4:30) Caracas' },
    { id: '-04:00', label: '(GMT -4:00) Atlantic Time (Canada), Caracas, La Paz' },
    { id: '-03:30', label: '(GMT -3:30) Newfoundland' },
    { id: '-03:00', label: '(GMT -3:00) Brazil, Buenos Aires, Georgetown' },
    { id: '-02:00', label: '(GMT -2:00) Mid-Atlantic' },
    { id: '-01:00', label: '(GMT -1:00) Azores, Cape Verde Islands' },
    { id: 'Z', label: '(GMT) Western Europe Time, London, Lisbon, Casablanca' },
    { id: '+01:00', label: '(GMT +1:00) Brussels, Copenhagen, Madrid, Paris' },
    { id: '+02:00', label: '(GMT +2:00) Kaliningrad, South Africa' },
    { id: '+03:00', label: '(GMT +3:00) Baghdad, Riyadh, Moscow, St. Petersburg' },
    { id: '+03:30', label: '(GMT +3:30) Tehran' },
    { id: '+04:00', label: '(GMT +4:00) Abu Dhabi, Muscat, Baku, Tbilisi' },
    { id: '+04:30', label: '(GMT +4:30) Kabul' },
    { id: '+05:00', label: '(GMT +5:00) Ekaterinburg, Islamabad, Karachi, Tashkent' },
    { id: '+05:30', label: '(GMT +5:30) Bombay, Calcutta, Madras, New Delhi' },
    { id: '+05:45', label: '(GMT +5:45) Kathmandu, Pokhara' },
    { id: '+06:00', label: '(GMT +6:00) Almaty, Dhaka, Colombo' },
    { id: '+06:30', label: '(GMT +6:30) Yangon, Mandalay' },
    { id: '+07:00', label: '(GMT +7:00) Bangkok, Hanoi, Jakarta' },
    { id: '+08:00', label: '(GMT +8:00) Beijing, Perth, Singapore, Hong Kong' },
    { id: '+08:45', label: '(GMT +8:45) Eucla' },
    { id: '+09:00', label: '(GMT +9:00) Tokyo, Seoul, Osaka, Sapporo, Yakutsk' },
    { id: '+09:30', label: '(GMT +9:30) Adelaide, Darwin' },
    { id: '+10:00', label: '(GMT +10:00) Eastern Australia, Guam, Vladivostok' },
    { id: '+10:30', label: '(GMT +10:30) Lord Howe Island' },
    { id: '+11:00', label: '(GMT +11:00) Magadan, Solomon Islands, New Caledonia' },
    { id: '+11:30', label: '(GMT +11:30) Norfolk Island' },
    { id: '+12:00', label: '(GMT +12:00) Auckland, Wellington, Fiji, Kamchatka' },
    { id: '+12:45', label: '(GMT +12:45) Chatham Islands' },
    { id: '+13:00', label: '(GMT +13:00) Apia, Nukualofa' },
    { id: '+14:00', label: '(GMT +14:00) Line Islands, Tokelau' },
  ];

  /**
   * Setup section.
   */
  @Input() getUserZone = false;
  @Input() customPlaceholderText = 'Choose...';
  @Input() customNotFoundText = 'No zone found';
  @Input() clearable = false;
  @Input() virtualScroll = true;
  @Input() disabled = false;

  @Input() set config(conf: SelectConfig) {
    this._config = conf;
  }

  private _config: SelectConfig = {
    hideSelected: false,
    dropdownPosition: 'auto',
    appearance: 'underline',
    clearOnBackspace: true,
    closeOnSelect: true,
    appendTo: null,
  };

  get config(): SelectConfig {
    return this._config;
  }

  /**
   * Internals section.
   */
  timeZones: Array<any>;
  form: FormGroup;
  private propagateChange: (_: any) => {};
  private destroy$ = new Subject<void>();

  constructor(private fb: FormBuilder) {}

  static guessedUserZone(): TZone {
    const guessedZone = momentZone.tz.guess(true);
    return TimezonePickerComponent.findZone(guessedZone);
  }

  static findZone(zone: string): TZone {
    const allZones = JSON.parse(JSON.stringify(TimezonePickerComponent.AVAILABLE_TIMEZONES));
    const utc: string = momentZone.tz(zone).format('Z');
    return allZones.find((z) => z.id === utc);
  }

  ngOnInit(): void {
    // make a copy of the list to avoid modifying the original timezones array
    this.timeZones = JSON.parse(JSON.stringify(TimezonePickerComponent.AVAILABLE_TIMEZONES));
    this.form = this.fb.group({
      timezone: [],
    });

    /**
     * Value change subscription.
     */
    this.form
      .get('timezone')
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.fireChanges());
  }

  ngAfterViewInit(): void {
    this.guessUserTimezone();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private guessUserTimezone(): void {
    setTimeout(() => {
      if (this.getUserZone) {
        const guessedZone = TimezonePickerComponent.guessedUserZone();
        this.form.get('timezone').setValue(guessedZone);
      }
    });
  }

  // /**
  //  * Make TZone object from simple string.
  //  * @link ngOnInit
  //  */
  // formatZone(zone: string): TZone {
  //   const utc: string = momentZone.tz(zone).format('Z');
  //   return this.timeZones.find(z => z.id === utc);
  // }

  /**
   * Propagate result to parent component.
   */
  private fireChanges(): void {
    if (this.propagateChange) {
      this.propagateChange(this.form.get('timezone').value);
    }
  }

  /**
   * Clear selection.
   */
  private clearZone(): void {
    this.form.get('timezone').setValue(null);
  }

  /**
   * Handle parent imports changes.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.getUserZone && changes.getUserZone.currentValue) {
      this.guessUserTimezone();
    }
    if (changes.disabled) {
      setTimeout(() => {
        changes.disabled.currentValue ? this.form.get('timezone').disable() : this.form.get('timezone').enable();
      });
    }
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {}

  /**
   * Handle parent model value changes.
   */
  writeValue(zone: string | TZone): void {
    if (zone) {
      let _zone: TZone = null;

      if (typeof zone === 'string' && zone.length > 0) {
        _zone = this.timeZones.find((z) => z.id === zone);
      } else if (typeof zone === 'object') {
        _zone = this.timeZones.find((z) => z.id === zone.id);
      }

      if (_zone) {
        this.form.get('timezone').setValue(_zone);
      }
    } else {
      this.clearZone();
    }
  }
}
