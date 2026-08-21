import { ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { vi } from 'vitest';
import { DateTimeService } from '../../service/date-time/date-time.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { DatePickerComponent } from './date-picker.component';

describe('DatePickerComponent lifecycle', () => {
  it('releases its read-only subscription when destroyed', () => {
    const teardown = vi.fn();
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
    );
    component.dateMonthYear = new FormControl<Date | null>(null);

    component.ngOnInit();
    expect(component.readOnlyMode).toBe(true);

    component.ngOnDestroy();
    expect(teardown).toHaveBeenCalledOnce();
  });
});
