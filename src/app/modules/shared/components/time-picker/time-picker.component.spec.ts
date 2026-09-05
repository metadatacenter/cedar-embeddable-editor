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

/**
 * Typing into a clock segment.
 *
 * A segment holds a draft while it is being edited and a canonical, padded value
 * when it is not, and the two are reconciled on blur. That cycle is most of this
 * widget and none of it was exercised: `clock-time.spec.ts` in the harness
 * covers the arithmetic underneath, which is a different question from when the
 * draft is kept, when it is replaced, and what a rejected edit restores.
 */
describe('TimePickerComponent segment editing', () => {
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

  /** The focus and blur a browser sends, with the element the handler reads. */
  const focusOn = (component: TimePickerComponent, field: 'hour' | 'minute' | 'second'): HTMLInputElement => {
    const input = document.createElement('input');
    input.value = '';
    component.segmentFocus({ target: input } as unknown as FocusEvent, field);
    return input;
  };

  const blurFrom = (
    component: TimePickerComponent,
    field: 'hour' | 'minute' | 'second',
    input: HTMLInputElement,
  ): void => {
    component.segmentBlur({ target: input, relatedTarget: null } as unknown as FocusEvent, field);
  };

  it('keeps a half-typed hour unpadded while it is being typed', () => {
    const { component } = makeComponent();
    const input = focusOn(component, 'hour');

    component.hourChanged('5');

    expect(component.hourDraft).toBe('5');
    expect(input).toBeDefined();
  });

  it('pads the segment once the user leaves it', () => {
    const { component } = makeComponent();
    const input = focusOn(component, 'hour');
    component.hourChanged('5');

    blurFrom(component, 'hour', input);

    expect(component.hourDraft).toBe('05');
    expect(input.value).toBe('05');
  });

  it('shows the parts the model padded once the user leaves the clock', () => {
    // A typed hour stores `09:00:00`, and `[(ngModel)]` writes that instant back
    // while the hour still has focus. The other two boxes went on showing `MM`
    // and `SS` over a stored `00` — a placeholder standing over a value, which is
    // the one thing a placeholder must not do.
    const { component, emitted } = makeComponent();
    const input = focusOn(component, 'hour');
    component.hourChanged('9');
    component.writeValue(emitted[0]);

    blurFrom(component, 'hour', input);

    expect([component.hourDraft, component.minuteDraft, component.secondDraft]).toEqual(['09', '00', '00']);
  });

  it('restores the stored value when a typed hour is out of range, and says so', () => {
    const { component, emitted } = makeComponent();
    component.hourChanged('9');
    emitted.length = 0;
    const input = focusOn(component, 'hour');

    component.hourChanged('25');
    expect(emitted).toEqual([]);

    blurFrom(component, 'hour', input);

    expect(component.restoredSegment).toBe('hour');
    expect(component.hourDraft).toBe('09');
  });

  it('says nothing about a segment the user got right', () => {
    const { component } = makeComponent();
    const input = focusOn(component, 'hour');
    component.hourChanged('9');

    blurFrom(component, 'hour', input);

    expect(component.restoredSegment).toBeNull();
  });

  it('rejects an hour past noon on a twelve-hour face', () => {
    const { component, emitted } = makeComponent(true);

    component.hourChanged('13');

    expect(emitted).toEqual([]);
  });

  it('accepts the same hour on a twenty-four-hour face', () => {
    const { component, emitted } = makeComponent();

    component.hourChanged('13');

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.getHours()).toBe(13);
  });

  it('replaces the segment on the first digit typed after focusing it', () => {
    // Focus selects the segment, so the next digit replaces rather than appends.
    const { component } = makeComponent();
    component.hourChanged('11');
    focusOn(component, 'hour');

    const event = { key: '4', preventDefault: vi.fn() } as unknown as KeyboardEvent;
    component.segmentKeydown(event, 'hour');

    expect(component.hourDraft).toBe('4');
    expect(component.hour).toBe(4);
  });

  it('appends the second digit rather than replacing again', () => {
    const { component } = makeComponent();
    focusOn(component, 'hour');
    component.segmentKeydown({ key: '1', preventDefault: vi.fn() } as unknown as KeyboardEvent, 'hour');

    component.segmentKeydown({ key: '4', preventDefault: vi.fn() } as unknown as KeyboardEvent, 'hour');
    // The second keystroke is the browser's to apply; the widget only stops
    // replacing. What it must not do is treat `4` as a fresh segment again.
    expect(component.hourDraft).toBe('1');
  });

  it('steps an hour up and down with the arrow keys', () => {
    const { component } = makeComponent();
    component.hourChanged('9');

    component.segmentKeydown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent, 'hour');
    expect(component.hour).toBe(10);

    component.segmentKeydown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent, 'hour');
    expect(component.hour).toBe(9);
  });

  it('wraps a stepped hour rather than stopping at the end of the clock', () => {
    const { component } = makeComponent();
    component.hourChanged('23');

    component.step('hour', 1);

    expect(component.hour).toBe(0);
    expect(component.hourDraft).toBe('00');
  });

  it('wraps minutes and seconds at sixty', () => {
    const { component } = makeComponent();
    component.minuteChanged('59');
    component.secondChanged('59');

    component.step('minute', 1);
    component.step('second', 1);

    expect([component.minute, component.second]).toEqual([0, 0]);
  });

  it('ignores a key that is neither a digit nor an arrow', () => {
    const { component } = makeComponent();
    component.hourChanged('9');

    component.segmentKeydown({ key: 'Tab', preventDefault: vi.fn() } as unknown as KeyboardEvent, 'hour');

    expect(component.hour).toBe(9);
  });

  it('leaves a locked clock alone when a step is attempted', () => {
    const { component, emitted } = makeComponent();
    component.hourChanged('9');
    component.setDisabledState(true);
    emitted.length = 0;

    component.step('hour', 1);

    expect(component.hour).toBe(9);
    expect(emitted).toEqual([]);
  });

  it('shows what the model wrote in, padded', () => {
    const { component } = makeComponent();

    component.writeValue(new Date(2026, 0, 1, 7, 5, 3));

    expect([component.hourDraft, component.minuteDraft, component.secondDraft]).toEqual(['07', '05', '03']);
  });

  it('leaves the segment being typed alone when the model writes back', () => {
    // `[(ngModel)]` and the temporal normalizer both write through `writeValue`,
    // and the first digit must not be padded before the second arrives.
    const { component } = makeComponent();
    focusOn(component, 'hour');
    component.hourChanged('5');

    component.writeValue(new Date(2026, 0, 1, 5, 30, 0));

    expect(component.hourDraft).toBe('5');
    expect(component.minute).toBe(30);
  });

  it('shows an empty clock as empty rather than as midnight', () => {
    const { component } = makeComponent();

    component.writeValue(null);

    expect([component.hourDraft, component.minuteDraft, component.secondDraft]).toEqual(['', '', '']);
    expect(component.hasValue).toBe(false);
  });

  it('reads a twelve-hour face back from the instant it stores', () => {
    const { component } = makeComponent(true);

    component.writeValue(new Date(2026, 0, 1, 0, 0, 0));
    expect([component.hour, component.meridian]).toEqual([12, 'AM']);

    component.writeValue(new Date(2026, 0, 1, 12, 0, 0));
    expect([component.hour, component.meridian]).toEqual([12, 'PM']);

    component.writeValue(new Date(2026, 0, 1, 15, 0, 0));
    expect([component.hour, component.meridian]).toEqual([3, 'PM']);
  });

  it('stores no minutes or seconds for an hour-granularity field', () => {
    const { component, emitted } = makeComponent();
    component.disableMinute = true;
    component.minuteChanged('45');

    component.hourChanged('9');

    const stored = emitted.at(-1)!;
    expect([stored.getHours(), stored.getMinutes(), stored.getSeconds()]).toEqual([9, 0, 0]);
  });

  it('stores no seconds for a field that does not show them', () => {
    const { component, emitted } = makeComponent();
    component.showSeconds = false;
    component.secondChanged('45');

    component.hourChanged('9');

    expect(emitted.at(-1)!.getSeconds()).toBe(0);
  });

  it('keeps the day a time edit lands on', () => {
    const { component, emitted } = makeComponent();
    component.writeValue(new Date(2026, 4, 17, 8, 0, 0));

    component.hourChanged('21');

    const stored = emitted.at(-1)!;
    expect([stored.getFullYear(), stored.getMonth(), stored.getDate()]).toEqual([2026, 4, 17]);
  });
});
