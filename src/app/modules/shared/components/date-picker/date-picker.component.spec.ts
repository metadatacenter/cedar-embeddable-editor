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
