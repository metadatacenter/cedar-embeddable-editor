import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { vi } from 'vitest';
import { FieldComponent } from '../../../shared/models/component/field-component.model';
import { InputType } from '../../../shared/models/input-type.model';
import { Temporal } from '../../../shared/models/temporal.model';
import { Xsd } from '../../../shared/models/xsd.model';
import { ActiveComponentRegistryService } from '../../../shared/service/active-component-registry.service';
import { UserPreferencesService } from '../../../shared/service/user-preferences.service';
import { CedarInputDatetimeComponent } from './cedar-input-datetime.component';

describe('CedarInputDatetimeComponent model-to-view sync', () => {
  const makeComponent = (
    temporalType: string,
    granularity: string,
  ): { component: CedarInputDatetimeComponent; written: (string | null)[] } => {
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: new UserPreferencesService() },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: registry },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new CedarInputDatetimeComponent(new FormBuilder(), registry),
    );
    // Through the input setter, which is what installs the validators — the
    // widget's own message comes off them.
    component.componentToRender = {
      basicInfo: { temporalGranularity: granularity, timezoneEnabled: false, inputType: InputType.temporal },
      valueInfo: { temporalType, requiredValue: false },
      path: ['when'],
    } as unknown as FieldComponent;
    const written: (string | null)[] = [];
    component.handlerContext = {
      changeValue: (_c: unknown, value: string | null) => written.push(value),
    } as never;
    return { component, written };
  };

  it('clears every displayed temporal part when the model has no value', () => {
    const { component } = makeComponent(Xsd.date, Temporal.day);

    component.setCurrentValue('2026-08-20');
    expect(component.dateMonthYearControl.value).not.toBeNull();

    component.setCurrentValue(null);

    expect(component.dateMonthYearControl.value).toBeNull();
    expect(component.timePickerTime).toBeNull();
    expect(component.decimalSeconds).toBeNull();
    expect(component.timezone).toBeNull();
    expect(component.hasTemporalValue()).toBe(false);
  });

  it('clears every displayed temporal part when the stored value cannot be read', () => {
    // The widget is reused as a repeating field pages between occurrences. It used
    // to return without touching the pickers, so occurrence one's instant stayed on
    // screen over occurrence two — and the next edit serialized those stale parts
    // back, overwriting occurrence two with occurrence one's value.
    const { component } = makeComponent(Xsd.dateTime, Temporal.minute);
    component.setCurrentValue('2026-08-20T14:30:00');
    expect(component.dateMonthYearControl.value).not.toBeNull();

    component.setCurrentValue('2021-06-06');

    expect(component.dateMonthYearControl.value).toBeNull();
    expect(component.timePickerTime).toBeNull();
    expect(component.hasTemporalValue()).toBe(false);
  });

  it('says so when the stored value cannot be read', () => {
    const { component } = makeComponent(Xsd.dateTime, Temporal.minute);

    component.setCurrentValue('2021-06-06');

    expect(component.showsValidationMessage).toBe(true);
    expect(component.validationMessage()).toContain('xsd:dateTime');
  });

  it('states nothing about a value it could read', () => {
    const { component } = makeComponent(Xsd.dateTime, Temporal.minute);

    component.setCurrentValue('2026-08-20T14:30:00');

    expect(component.showsValidationMessage).toBe(false);
  });

  it('does not write a stale instant back when an unreadable value is edited', () => {
    const { component, written } = makeComponent(Xsd.dateTime, Temporal.minute);
    component.setCurrentValue('2026-08-20T14:30:00');
    component.setCurrentValue('2021-06-06');
    written.length = 0;

    component.timezoneInputChanged(null);

    expect(written).toEqual([null]);
  });
});

/**
 * Which controls a temporal field offers, and what an edit to one of them stores.
 *
 * Granularity decides both. A field records `year` through `decimalSecond`, and
 * every part finer than the one it declares is padded to a neutral value rather
 * than asked for — so the same edit stores a different lexical value depending
 * on what the template said. Which controls appear was covered by the visual
 * baselines only, and what an edit stores by nothing at all.
 */
describe('CedarInputDatetimeComponent by granularity', () => {
  const makeField = (
    temporalType: string,
    granularity: string,
    { timezoneEnabled = false, inputTimeFormat = '', requiredValue = false } = {},
  ): { component: CedarInputDatetimeComponent; written: (string | null)[] } => {
    const registry = {
      registerComponent: vi.fn(),
      unregisterComponent: vi.fn(),
    } as unknown as ActiveComponentRegistryService;
    const injector = Injector.create({
      providers: [
        { provide: UserPreferencesService, useValue: new UserPreferencesService() },
        { provide: ChangeDetectorRef, useValue: { markForCheck: vi.fn(), detectChanges: vi.fn() } },
        { provide: ActiveComponentRegistryService, useValue: registry },
      ],
    });
    const component = runInInjectionContext(
      injector,
      () => new CedarInputDatetimeComponent(new FormBuilder(), registry),
    );
    component.componentToRender = {
      basicInfo: { temporalGranularity: granularity, timezoneEnabled, inputTimeFormat, inputType: InputType.temporal },
      valueInfo: { temporalType, requiredValue },
      path: ['when'],
    } as unknown as FieldComponent;
    const written: (string | null)[] = [];
    component.handlerContext = {
      changeValue: (_c: unknown, value: string | null) => written.push(value),
    } as never;
    return { component, written };
  };

  /**
   * When the field says what is wrong with its value.
   *
   * A part picked from a popup — a date from the calendar, an offset from the
   * list — is an edit like any other, and used to count as none: the signal
   * was DOM events on the widget, and Material dispatches none for either. A
   * required dateTime with only its date picked therefore stored nothing and
   * said nothing, over a box that looked half filled.
   */
  describe('what it says', () => {
    it('says a required field is still unanswered once only its date has been picked', () => {
      const { component, written } = makeField(Xsd.dateTime, Temporal.minute, { requiredValue: true });

      component.dateInputChanged(new Date(2027, 5, 17));

      expect(written.at(-1)).toBeNull();
      expect(component.showsValidationMessage).toBe(true);
      expect(component.validationMessage()).toBe('The value is required.');
    });

    it('says the same once only an offset has been chosen', () => {
      const { component } = makeField(Xsd.dateTime, Temporal.minute, { timezoneEnabled: true, requiredValue: true });

      component.timezoneInputChanged({ id: '+02:00', label: 'UTC+02:00' });

      expect(component.showsValidationMessage).toBe(true);
    });

    it('says nothing about a required field nobody has touched', () => {
      const { component } = makeField(Xsd.dateTime, Temporal.minute, { requiredValue: true });

      expect(component.showsValidationMessage).toBe(false);
    });

    it('says nothing once both halves are in', () => {
      const { component } = makeField(Xsd.dateTime, Temporal.minute, { requiredValue: true });
      component.dateInputChanged(new Date(2027, 5, 17));

      component.timePickerTime = new Date(2027, 5, 17, 14, 30, 0);
      component.timeInputChanged(null);

      expect(component.showsValidationMessage).toBe(false);
    });
  });

  describe('which controls it offers', () => {
    it('offers a date and no clock for an xsd:date field', () => {
      const { component } = makeField(Xsd.date, Temporal.day);

      expect([component.showDatePicker(), component.showTimePicker()]).toEqual([true, false]);
    });

    it('offers a clock and no date for an xsd:time field', () => {
      const { component } = makeField(Xsd.time, Temporal.minute);

      expect([component.showDatePicker(), component.showTimePicker()]).toEqual([false, true]);
    });

    it('offers both for an xsd:dateTime field', () => {
      const { component } = makeField(Xsd.dateTime, Temporal.minute);

      expect([component.showDatePicker(), component.showTimePicker()]).toEqual([true, true]);
    });

    it('offers no clock on a dateTime that stops at the day', () => {
      const { component } = makeField(Xsd.dateTime, Temporal.day);

      expect(component.showTimePicker()).toBe(false);
    });

    it('asks the date picker for only as much as the field records', () => {
      expect(makeField(Xsd.date, Temporal.year).component.dateFormat()).toBe('YYYY');
      expect(makeField(Xsd.date, Temporal.month).component.dateFormat()).toBe('MM/YYYY');
      expect(makeField(Xsd.date, Temporal.day).component.dateFormat()).toBe('MM/DD/YYYY');
    });

    it('hides the minutes an hour-granularity field does not record', () => {
      expect(makeField(Xsd.time, Temporal.hour).component.disableMinute()).toBe(true);
      expect(makeField(Xsd.time, Temporal.minute).component.disableMinute()).toBe(false);
    });

    it('shows seconds only where they are recorded', () => {
      expect(makeField(Xsd.time, Temporal.minute).component.showSeconds()).toBe(false);
      expect(makeField(Xsd.time, Temporal.second).component.showSeconds()).toBe(true);
      expect(makeField(Xsd.time, Temporal.decimalSecond).component.showSeconds()).toBe(true);
    });

    it('shows a fraction box only at decimal-second granularity', () => {
      expect(makeField(Xsd.time, Temporal.second).component.showDecimalSeconds()).toBe(false);
      expect(makeField(Xsd.time, Temporal.decimalSecond).component.showDecimalSeconds()).toBe(true);
    });

    it('offers an offset only where the template enables one', () => {
      expect(makeField(Xsd.dateTime, Temporal.minute).component.showTimezonePicker()).toBe(false);
      expect(makeField(Xsd.dateTime, Temporal.minute, { timezoneEnabled: true }).component.showTimezonePicker()).toBe(
        true,
      );
    });

    it('offers a twelve-hour face only where the template asks for one', () => {
      expect(makeField(Xsd.time, Temporal.minute).component.enableMeridian()).toBe(false);
      expect(
        makeField(Xsd.time, Temporal.minute, { inputTimeFormat: Temporal.inputType12h }).component.enableMeridian(),
      ).toBe(true);
    });
  });

  describe('what an edit stores', () => {
    it('pads a year-granularity date to the first of January', () => {
      const { component, written } = makeField(Xsd.date, Temporal.year);

      component.dateInputChanged(new Date(2027, 5, 17));

      expect(written.at(-1)).toBe('2027-01-01');
    });

    it('pads a month-granularity date to the first of the month', () => {
      const { component, written } = makeField(Xsd.date, Temporal.month);

      component.dateInputChanged(new Date(2027, 5, 17));

      expect(written.at(-1)).toBe('2027-06-01');
    });

    it('stores a day-granularity date as it stands', () => {
      const { component, written } = makeField(Xsd.date, Temporal.day);

      component.dateInputChanged(new Date(2027, 5, 17));

      expect(written.at(-1)).toBe('2027-06-17');
    });

    it('stores nothing until a dateTime has both halves', () => {
      const { component, written } = makeField(Xsd.dateTime, Temporal.minute);

      component.dateInputChanged(new Date(2027, 5, 17));
      expect(written.at(-1)).toBeNull();

      component.timePickerTime = new Date(2027, 5, 17, 14, 30, 0);
      component.timeInputChanged(null);

      expect(written.at(-1)).toBe('2027-06-17T14:30:00');
    });

    it('pads a dateTime that stops at the day to midnight', () => {
      const { component, written } = makeField(Xsd.dateTime, Temporal.day);

      component.dateInputChanged(new Date(2027, 5, 17));

      expect(written.at(-1)).toBe('2027-06-17T00:00:00');
    });

    it('records the seconds a second-granularity field asks for', () => {
      const { component, written } = makeField(Xsd.time, Temporal.second);
      component.timePickerTime = new Date(2027, 0, 1, 9, 8, 7);

      component.timeInputChanged(null);

      expect(written.at(-1)).toBe('09:08:07');
    });

    it('discards the seconds a minute-granularity field does not', () => {
      const { component, written } = makeField(Xsd.time, Temporal.minute);
      component.timePickerTime = new Date(2027, 0, 1, 9, 8, 7);

      component.timeInputChanged(null);

      expect(written.at(-1)).toBe('09:08:00');
    });

    it('stores nothing until a decimal-second field has its fraction', () => {
      const { component, written } = makeField(Xsd.time, Temporal.decimalSecond);
      component.timePickerTime = new Date(2027, 0, 1, 9, 8, 7);
      component.timeInputChanged(null);
      expect(written.at(-1)).toBeNull();

      component.decimalSeconds = '250';
      component.decimalSecondsChanged(null);

      expect(written.at(-1)).toBe('09:08:07.250');
    });

    it('takes a fraction however the user spells it', () => {
      const { component, written } = makeField(Xsd.time, Temporal.decimalSecond);
      component.timePickerTime = new Date(2027, 0, 1, 9, 8, 7);
      component.timeInputChanged(null);

      component.decimalSeconds = '0.5';
      component.decimalSecondsChanged(null);

      expect(written.at(-1)).toBe('09:08:07.5');
    });

    it('appends the offset a field that enables one is given', () => {
      const { component, written } = makeField(Xsd.time, Temporal.minute, { timezoneEnabled: true });
      component.timePickerTime = new Date(2027, 0, 1, 9, 30, 0);
      component.timeInputChanged(null);

      component.timezoneInputChanged({ id: '+05:30', label: 'UTC+05:30' });

      expect(written.at(-1)).toBe('09:30:00+05:30');
    });

    it('drops an offset a field that enables none is given', () => {
      const { component, written } = makeField(Xsd.time, Temporal.minute);
      component.timePickerTime = new Date(2027, 0, 1, 9, 30, 0);
      component.timeInputChanged(null);

      component.timezoneInputChanged({ id: '+05:30', label: 'UTC+05:30' });

      expect(written.at(-1)).toBe('09:30:00');
    });

    it('empties every part on one clear', () => {
      const { component, written } = makeField(Xsd.dateTime, Temporal.minute, { timezoneEnabled: true });
      component.setCurrentValue('2027-06-17T14:30:00+05:30');

      component.clearValue();

      expect(written.at(-1)).toBeNull();
      expect(component.hasTemporalValue()).toBe(false);
      expect([component.timePickerTime, component.timezone, component.decimalSeconds]).toEqual([null, null, null]);
    });

    it('ignores a clock change while there is no time to change', () => {
      const { component, written } = makeField(Xsd.time, Temporal.minute);

      component.timeInputChanged(null);

      expect(written).toEqual([]);
    });
  });

  describe('what a reader sees', () => {
    it('cuts a stored instant to what the field records', () => {
      const year = makeField(Xsd.date, Temporal.year).component;
      year.setCurrentValue('2027-01-01');
      expect(year.readOnlyValue()).toBe('2027');

      const day = makeField(Xsd.dateTime, Temporal.day).component;
      day.setCurrentValue('2027-06-17T00:00:00');
      expect(day.readOnlyValue()).toBe('2027-06-17');

      const minute = makeField(Xsd.dateTime, Temporal.minute).component;
      minute.setCurrentValue('2027-06-17T14:30:00');
      expect(minute.readOnlyValue()).toBe('2027-06-17 14:30');
    });

    it('keeps an offset whole, whatever the granularity trims', () => {
      const { component } = makeField(Xsd.dateTime, Temporal.day, { timezoneEnabled: true });
      component.setCurrentValue('2027-06-17T00:00:00+05:30');

      expect(component.readOnlyValue()).toBe('2027-06-17 +05:30');
    });

    it('shows a time-only field its time', () => {
      const { component } = makeField(Xsd.time, Temporal.minute);
      component.setCurrentValue('14:30:00');

      expect(component.readOnlyValue()).toBe('14:30');
    });

    it('shows nothing for a field holding nothing', () => {
      const { component } = makeField(Xsd.date, Temporal.day);

      expect(component.readOnlyValue()).toBe('');
    });
  });
});
