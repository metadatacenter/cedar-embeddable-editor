import { DestroyRef } from '@angular/core';
import { Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { TimePickerComponent } from './time-picker.component';

/**
 * The clock as a control, rather than the arithmetic behind it.
 *
 * `harness/test/clock-time.spec.ts` covers `ClockTime` — which hour a face
 * means, and how a segment wraps. What it cannot cover is when this widget
 * decides it has a time to report at all, which is the question below.
 */
describe('TimePickerComponent', () => {
  const makeComponent = (enableMeridian = false): { component: TimePickerComponent; emitted: (Date | null)[] } => {
    const destroyRef = { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef;
    const preferences = {
      readOnlyMode$: new Observable<boolean>(() => undefined),
    } as unknown as UserPreferencesService;
    const component = new TimePickerComponent(preferences, destroyRef);
    component.enableMeridian = enableMeridian;
    component.showSeconds = true;
    const emitted: (Date | null)[] = [];
    component.registerOnChange((value: Date) => emitted.push(value));
    return { component, emitted };
  };

  it('reports no time when only AM/PM is toggled on an empty clock', () => {
    // A meridian expresses something about a time; it is not one. Toggling it
    // built an instant out of `new Date()` and reported it, so a field nobody
    // had entered a time into recorded midnight.
    const { component, emitted } = makeComponent(true);

    component.toggleMeridian();

    expect(emitted).toEqual([]);
    expect(component.meridian).toBe('PM');
  });

  it('honours a meridian chosen before the hour was typed', () => {
    const { component, emitted } = makeComponent(true);
    component.toggleMeridian();

    component.hourChanged('3');

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.getHours()).toBe(15);
  });

  it('reports a time when AM/PM is toggled over one', () => {
    const { component, emitted } = makeComponent(true);
    component.hourChanged('3');
    emitted.length = 0;

    component.toggleMeridian();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.getHours()).toBe(15);
  });

  it('reports a time when an hour is typed on a 24-hour clock', () => {
    const { component, emitted } = makeComponent();

    component.hourChanged('14');

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.getHours()).toBe(14);
  });

  it('reports nothing for an hour outside the face being shown', () => {
    const { component, emitted } = makeComponent();

    component.hourChanged('25');

    expect(emitted).toEqual([]);
  });
});
