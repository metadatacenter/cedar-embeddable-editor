import { DestroyRef, ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { vi } from 'vitest';
import { DateTimeService } from '../../service/date-time/date-time.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { DatePickerComponent } from './date-picker.component';

describe('DatePickerComponent lifecycle', () => {
  it('releases its read-only subscription through the Angular destroy scope', () => {
    const teardown = vi.fn();
    const callbacks = new Set<() => void>();
    const destroyRef = {
      destroyed: false,
      onDestroy: (callback: () => void) => {
        callbacks.add(callback);
        return () => {
          callbacks.delete(callback);
        };
      },
    } as DestroyRef;
    const preferences = {
      readOnlyMode$: new Observable<boolean>((subscriber) => {
        subscriber.next(true);
        return teardown;
      }),
    } as unknown as UserPreferencesService;
    const component = new DatePickerComponent(
      {} as DateTimeService,
      preferences,
      new ElementRef(document.createElement('app-date-picker')),
      destroyRef,
    );
    component.dateMonthYear = new FormControl<Date | null>(null);

    component.ngOnInit();
    expect(component.readOnlyMode).toBe(true);

    callbacks.forEach((callback) => callback());
    expect(teardown).toHaveBeenCalledOnce();
  });
});

/**
 * What the box shows and what the field records have to be the same date.
 *
 * The two are set in different places — the control by the calendar's handlers,
 * the value by `dateChangedEvent` — and nothing held them together.
 */
describe('DatePickerComponent selection', () => {
  const makeComponent = (dateFormat: string): { component: DatePickerComponent; emitted: Date[] } => {
    const destroyRef = { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef;
    const preferences = {
      readOnlyMode$: new Observable<boolean>(() => undefined),
    } as unknown as UserPreferencesService;
    const component = new DatePickerComponent(
      {} as DateTimeService,
      preferences,
      new ElementRef(document.createElement('app-date-picker')),
      destroyRef,
    );
    component.dateMonthYear = new FormControl<Date | null>(null);
    component.dateFormat = dateFormat;
    const emitted: Date[] = [];
    component.dateChangedEvent.subscribe((date: Date) => emitted.push(date));
    return { component, emitted };
  };

  const picker = { close: (): void => undefined } as never;

  it('records the year a year-and-month field is given', () => {
    // Selecting a year set the control and emitted nothing, so the box read the
    // new year while the instance kept the old one — and closing the calendar
    // without going on to pick a month left them that way.
    const { component, emitted } = makeComponent(DatePickerComponent.YEAR_MONTH_FORMAT);
    component.dateMonthYear.setValue(new Date(2020, 4, 1));

    component.chosenYearHandler(new Date(2027, 0, 1), picker);

    expect(component.dateMonthYear.value?.getFullYear()).toBe(2027);
    expect(emitted.map((d) => [d.getFullYear(), d.getMonth()])).toEqual([[2027, 4]]);
  });

  it('pads an unset year-and-month field to January rather than to this month', () => {
    // The month came off `new Date()` when the field held nothing, so picking a
    // year recorded whichever month the form happened to be opened in.
    const { component, emitted } = makeComponent(DatePickerComponent.YEAR_MONTH_FORMAT);

    component.chosenYearHandler(new Date(2027, 0, 1), picker);

    expect(emitted[0].getMonth()).toBe(0);
    expect(component.dateMonthYear.value?.getMonth()).toBe(0);
  });

  it('records the month a year-and-month field is given', () => {
    const { component, emitted } = makeComponent(DatePickerComponent.YEAR_MONTH_FORMAT);
    component.chosenYearHandler(new Date(2027, 0, 1), picker);

    component.chosenMonthHandler(new Date(2027, 8, 1), picker);

    expect(emitted.map((d) => [d.getFullYear(), d.getMonth()])).toEqual([
      [2027, 0],
      [2027, 8],
    ]);
  });

  it('records the year a year-only field is given', () => {
    const { component, emitted } = makeComponent(DatePickerComponent.YEAR_FORMAT);

    component.chosenYearHandler(new Date(2027, 6, 1), picker);

    expect(emitted.map((d) => [d.getFullYear(), d.getMonth(), d.getDate()])).toEqual([[2027, 0, 1]]);
  });
});
