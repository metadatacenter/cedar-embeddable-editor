import { DestroyRef } from '@angular/core';
import { Observable, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { TimezonePickerComponent, TZone } from './timezone-picker.component';

/**
 * The offset a temporal value carries.
 *
 * CEDAR stores a fixed offset — `+05:30`, `Z` — and not an IANA zone, so this
 * widget's whole job is turning an offset into something to show and back
 * again. It was the least covered control in the editor that reads a value from
 * a user, at 12% of statements and 6% of branches.
 *
 * The offset a stored value carries need not be one of the forty-two this list
 * offers, and `writeValue` is the boundary that decides. That is the case worth
 * covering: an offset the picker cannot show is an offset it would silently
 * drop.
 */
describe('TimezonePickerComponent', () => {
  const makeComponent = (): { component: TimezonePickerComponent; emitted: (TZone | null)[] } => {
    const destroyRef = { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef;
    const component = new TimezonePickerComponent(
      { readOnlyMode$: of(false) } as unknown as UserPreferencesService,
      destroyRef,
    );
    const emitted: (TZone | null)[] = [];
    component.registerOnChange((value: TZone | null) => emitted.push(value));
    component.ngOnInit();
    return { component, emitted };
  };

  const shownOffset = (component: TimezonePickerComponent): string | null =>
    component.form.controls.timezone.value?.id ?? null;

  describe('reading an offset back', () => {
    it('shows an offset the list offers', () => {
      const { component } = makeComponent();

      component.writeValue('+05:30');

      expect(shownOffset(component)).toBe('+05:30');
    });

    it('shows UTC for every spelling of no offset', () => {
      for (const spelling of ['Z', '+00:00', '-00:00']) {
        const { component } = makeComponent();

        component.writeValue(spelling);

        expect(shownOffset(component), `${spelling} did not read as UTC`).toBe('Z');
      }
    });

    it('offers an offset the list does not carry rather than dropping it', () => {
      // A stored value need not name one of the forty-two offered. Refusing to
      // show it would leave the control blank over an instance that holds one.
      const { component } = makeComponent();

      component.writeValue('+07:15');

      expect(shownOffset(component)).toBe('+07:15');
      expect(component.timeZones.map((zone) => zone.id)).toContain('+07:15');
    });

    it('shows nothing for an offset that is not one', () => {
      const { component } = makeComponent();
      component.writeValue('+05:30');

      component.writeValue('halfway to Mars');

      expect(shownOffset(component)).toBeNull();
    });

    it('shows nothing when the field holds no offset', () => {
      const { component } = makeComponent();
      component.writeValue('+05:30');

      component.writeValue(null);

      expect(shownOffset(component)).toBeNull();
    });

    it('takes the zone object the picker itself emits', () => {
      const { component } = makeComponent();

      component.writeValue({ id: '-08:00', label: 'UTC-08:00' });

      expect(shownOffset(component)).toBe('-08:00');
    });

    it('reports nothing back to the model for a value the model wrote in', () => {
      const { component, emitted } = makeComponent();

      component.writeValue('+05:30');

      expect(emitted).toEqual([]);
    });
  });

  describe('what counts as an offset', () => {
    it.each(['+14:00', '-12:00', '+05:45', '-09:30', '+13:45'])('accepts %s', (offset) => {
      expect(TimezonePickerComponent.zoneForOffset(offset)?.id).toBe(offset);
    });

    it.each(['+15:00', '+5:30', '05:30', '+05:60', '', 'Europe/Budapest'])('rejects %s', (offset) => {
      expect(TimezonePickerComponent.zoneForOffset(offset)).toBeNull();
    });

    /*
     * Looser than the offsets that exist, which run -12:00 to +14:00.
     *
     * The pattern special-cases `+14:00` above its `1[0-3]` hours, so the upper
     * bound was thought about; the hour alternation applies to both signs, so
     * `-13:00` and `-13:45` pass while no such offset exists. The list this
     * widget offers is correctly bounded, so a user cannot choose one — it takes
     * a host-supplied instance carrying it.
     *
     * Recorded as it behaves rather than tightened. Refusing it would show an
     * empty control over an instance that holds something, and which of those is
     * wanted is a product call.
     */
    it.each(['-13:00', '-13:45'])('accepts %s, which is not an offset that exists', (offset) => {
      expect(TimezonePickerComponent.zoneForOffset(offset)?.id).toBe(offset);
    });

    it('labels UTC as itself and every other offset by its sign', () => {
      expect(TimezonePickerComponent.zoneForOffset('Z')?.label).toBe('UTC (Z)');
      expect(TimezonePickerComponent.zoneForOffset('+05:30')?.label).toBe('UTC+05:30');
    });
  });

  describe('choosing one', () => {
    it('reports the chosen offset to the model', () => {
      const { component, emitted } = makeComponent();

      component.form.controls.timezone.setValue(TimezonePickerComponent.zoneForOffset('+09:00'));

      expect(emitted.at(-1)?.id).toBe('+09:00');
    });

    it('reports the offset being cleared', () => {
      const { component, emitted } = makeComponent();
      component.form.controls.timezone.setValue(TimezonePickerComponent.zoneForOffset('+09:00'));

      component.form.controls.timezone.setValue(null);

      expect(emitted.at(-1)).toBeNull();
    });

    it('matches two zones by their offset rather than by identity', () => {
      // The control holds an object and `mat-select` compares against the option
      // objects it rendered, which are not the same instances.
      expect(component_compare({ id: '+01:00', label: 'x' }, { id: '+01:00', label: 'y' })).toBe(true);
      expect(component_compare({ id: '+01:00', label: 'x' }, { id: '+02:00', label: 'x' })).toBe(false);
      expect(component_compare(null, null)).toBe(true);
    });
  });

  describe('when the host asks for the viewer own offset', () => {
    it('fills an empty control with it', () => {
      const destroyRef = { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef;
      const component = new TimezonePickerComponent(
        { readOnlyMode$: new Observable<boolean>(() => undefined) } as unknown as UserPreferencesService,
        destroyRef,
      );
      component.getUserZone = true;

      component.ngOnInit();

      expect(shownOffset(component)).toBe(TimezonePickerComponent.guessedUserZone().id);
    });

    it('leaves an offset the instance already carries alone', () => {
      const { component } = makeComponent();
      component.writeValue('+05:30');
      component.getUserZone = true;

      component.ngOnChanges();

      expect(shownOffset(component)).toBe('+05:30');
    });
  });

  it('locks the control when the form disables it', () => {
    const { component } = makeComponent();

    component.setDisabledState(true);
    expect(component.form.controls.timezone.disabled).toBe(true);

    component.setDisabledState(false);
    expect(component.form.controls.timezone.disabled).toBe(false);
  });

  it('tells the model the control was touched when the list closes', () => {
    const { component } = makeComponent();
    const touched = vi.fn();
    component.registerOnTouched(touched);

    component.markTouched();

    expect(touched).toHaveBeenCalledOnce();
  });
});

/** `compareWith` is a plain predicate; it needs no instance to answer. */
const component_compare = (first: TZone | null, second: TZone | null): boolean => {
  const destroyRef = { destroyed: false, onDestroy: () => () => undefined } as unknown as DestroyRef;
  return new TimezonePickerComponent(
    { readOnlyMode$: of(false) } as unknown as UserPreferencesService,
    destroyRef,
  ).compareZones(first, second);
};
