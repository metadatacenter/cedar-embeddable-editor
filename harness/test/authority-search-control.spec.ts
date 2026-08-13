/**
 * Leaving a half-typed search behind in an external authority field.
 *
 * These seven widgets are search boxes: the control holds what is being typed,
 * and a value exists only once a term is picked from the autocomplete. Text
 * left in the box on blur therefore names nothing and cannot be saved — but six
 * of the seven left it sitting there, so the field displayed content the
 * instance did not contain. It looked filled and read back blank.
 *
 * `AuthoritySearchControl.reconcileOnBlur` is the rule, in one place, because
 * those six are copies of each other and had already drifted apart: ROR carried
 * the revert machinery but never bound it to a blur event, and the five
 * simplest had no blur handler at all.
 */
import { describe, expect, it } from 'vitest';
import { AuthoritySearchControl } from '@cee/util/authority-search-control';

/** Everything the rule needs a control to be. */
class FakeControl {
  value: unknown;
  errors: Record<string, unknown> | null = null;
  touched = false;
  emitted: boolean[] = [];

  constructor(value: unknown) {
    this.value = value;
  }
  setValue(v: unknown, opts?: { emitEvent?: boolean }): void {
    this.value = v;
    this.emitted.push(opts?.emitEvent !== false);
  }
  setErrors(e: Record<string, unknown> | null): void {
    this.errors = e;
  }
  markAsTouched(): void {
    this.touched = true;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reconcile = (typed: unknown, selectedDisplay: string | null) => {
  const control = new FakeControl(typed);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outcome = AuthoritySearchControl.reconcileOnBlur(control as any, selectedDisplay);
  return { outcome, control };
};

describe('text with no term behind it', () => {
  /**
   * REGRESSION: the case the user hit. Type a name, tab away, and the text
   * stayed — over a field holding nothing.
   */
  it('is cleared without manufacturing a validation error', () => {
    const { outcome, control } = reconcile('zzz nonsense', null);
    expect(outcome).toBe('cleared');
    expect(control.value).toBe('');
    expect(control.errors).toBeNull();
  });

  /** A real required validator still needs to become visible when focus leaves. */
  it('marks the control touched so genuine validation errors can render', () => {
    expect(reconcile('zzz', null).control.touched).toBe(true);
  });

  it('emits, so the model hears the field is empty', () => {
    expect(reconcile('zzz', null).control.emitted).toEqual([true]);
  });

  it('treats whitespace as nothing typed', () => {
    const { outcome, control } = reconcile('   ', null);
    expect(outcome).toBe('unchanged');
    expect(control.errors).toBeNull();
  });
});

describe('an edit over a term that is still selected', () => {
  const SELECTED = 'Homo sapiens - https://example.org/terms/9606';

  /**
   * The edit named nothing, but the term underneath is untouched — so the box
   * goes back to showing it rather than emptying. No error: nothing was lost.
   */
  it('reverts to the term rather than clearing', () => {
    const { outcome, control } = reconcile('Homo sap', SELECTED);
    expect(outcome).toBe('reverted');
    expect(control.value).toBe(SELECTED);
    expect(control.errors).toBeNull();
  });

  it('does not emit, because the value never changed', () => {
    expect(reconcile('Homo sap', SELECTED).control.emitted).toEqual([false]);
  });

  it('reverts an emptied box too, since the term is still selected', () => {
    expect(reconcile('', SELECTED).outcome).toBe('reverted');
  });
});

describe('nothing to reconcile', () => {
  it('leaves the selected term alone', () => {
    const display = 'Term - https://x/1';
    const { outcome, control } = reconcile(display, display);
    expect(outcome).toBe('unchanged');
    expect(control.emitted).toEqual([]);
  });

  it('ignores surrounding whitespace when comparing', () => {
    expect(reconcile('  Term - https://x/1  ', 'Term - https://x/1').outcome).toBe('unchanged');
  });

  it('leaves an untouched empty field alone', () => {
    const { outcome, control } = reconcile('', null);
    expect(outcome).toBe('unchanged');
    expect(control.errors).toBeNull();
  });

  it('survives a null value', () => {
    expect(reconcile(null, null).outcome).toBe('unchanged');
  });
});
