/**
 * The Angular adapter that puts the widgets and the report on one validator.
 *
 * Each widget used to declare its constraints as a hand-rolled set of
 * `Validators.*` calls, and the report decided validity separately. That is how
 * a form came to show a red error while the report called the same instance
 * valid. `CedarValidators.forComponent` wraps `FieldValueValidator` as an
 * Angular `ValidatorFn`, so there is now one definition of "valid" and the two
 * cannot drift.
 *
 * Tested here rather than through the browser because it is a pure function of
 * a component and a value — the visual suite covers that the widgets render the
 * result.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, NumberType } from 'cedar-model-typescript-library';
import { CedarValidators } from '@cee/validation/cedar-validators';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

let seq = 0;
const kindOf = (inputType: string, make: () => any, configure?: (b: any) => any): FieldKind => ({
  key: `w${seq++}`,
  inputType,
  make,
  isStatic: false,
  write: 'value',
  sample: 'x',
  configure,
});

/** Component as CEE parses it, so the validator sees real parsed constraints. */
const componentFor = (kind: FieldKind) =>
  new CeeDriver(buildTemplate({ name: kind.key, children: [{ kind, name: 'f' }] })).findOrThrow(['_f']);

/** One error detail: the validator's message and the value that produced it. */
interface ErrorDetail {
  message: string;
  value: unknown;
}

/**
 * What `forComponent`'s validator takes, without naming `@angular/forms`.
 *
 * The harness stubs `@angular/core` and imports no Angular package of its own,
 * so `AbstractControl` is derived from the function under test rather than
 * imported. A control here only ever carries a `value`.
 */
type ValidatedControl = Parameters<ReturnType<typeof CedarValidators.forComponent>>[0];

/** Run the adapter the way Angular would. */
const errorsFor = (kind: FieldKind, value: unknown): Record<string, ErrorDetail> | null =>
  CedarValidators.forComponent(componentFor(kind))({ value } as unknown as ValidatedControl) as Record<
    string,
    ErrorDetail
  > | null;

/**
 * The errors a value produces, when the point of the case is that it produces
 * some.
 *
 * `forComponent` answers null for a value that satisfies every constraint, so a
 * case asserting which code came back is also asserting that something did. That
 * belongs in one sentence rather than as a null dereference inside
 * `Object.keys`.
 */
const failuresFor = (kind: FieldKind, value: unknown): Record<string, ErrorDetail> => {
  const errors = errorsFor(kind, value);
  if (errors === null) {
    throw new Error(`Expected ${JSON.stringify(value)} to fail validation on a ${kind.inputType} field. It passed.`);
  }
  return errors;
};

describe('the adapter reports the same problems as the report', () => {
  it.each([
    ['a malformed email', () => kindOf('email', () => CedarBuilders.emailFieldBuilder()), 'not-an-email', 'email'],
    [
      'text under minLength',
      () =>
        kindOf(
          'textfield',
          () => CedarBuilders.textFieldBuilder(),
          (b) => b.withMinLength(8),
        ),
      'abc',
      'minLength',
    ],
    [
      'a regex mismatch',
      () =>
        kindOf(
          'textfield',
          () => CedarBuilders.textFieldBuilder(),
          (b) => b.withRegex('^[A-Z]{3}$'),
        ),
      'zzz',
      'regex',
    ],
    [
      'a numeric type mismatch',
      () =>
        kindOf(
          'numeric',
          () => CedarBuilders.numericFieldBuilder(),
          (b) => b.withNumberType(NumberType.INT),
        ),
      '3.7',
      'numberType',
    ],
    [
      'a numeric out of range',
      () =>
        kindOf(
          'numeric',
          () => CedarBuilders.numericFieldBuilder(),
          (b) => b.withNumberType(NumberType.INT).withMaxValue(10),
        ),
      '999',
      'maxValue',
    ],
  ])('%s produces the %s error', (_label, make, value, code) => {
    expect(Object.keys(failuresFor(make(), value))).toContain(code);
  });

  it('returns null for a value that satisfies every constraint', () => {
    const kind = kindOf('email', () => CedarBuilders.emailFieldBuilder());
    expect(errorsFor(kind, 'someone@example.org')).toBeNull();
  });

  it('validates each multi-select label rather than their comma-joined display text', () => {
    const kind = kindOf(
      'list',
      () => CedarBuilders.multipleChoiceListFieldBuilder(),
      (b) => b.addListOption('Alpha').addListOption('Beta').addListOption('Gamma'),
    );

    expect(errorsFor(kind, ['Alpha', 'Beta'])).toBeNull();
    expect(Object.keys(failuresFor(kind, ['Alpha', 'Zeta']))).toContain('choiceMembership');
  });

  /**
   * Absence is `Validators.required`'s job, which the widgets keep. If the
   * adapter also complained about empty values, every untouched field on a
   * fresh form would render an error.
   */
  it.each([[null], [undefined], ['']])('returns null for the empty value %s', (empty) => {
    const kind = kindOf('email', () => CedarBuilders.emailFieldBuilder());
    expect(errorsFor(kind, empty)).toBeNull();
  });
});

describe('legacy error keys still fire', () => {
  /**
   * Sixteen templates were written against Angular's own key names. The adapter
   * emits both the canonical code and the legacy alias so one validator can
   * replace the hand-rolled ones without rewriting the templates, and without
   * silently dropping messages users currently see.
   */
  it.each([
    [
      'minlength',
      () =>
        kindOf(
          'textfield',
          () => CedarBuilders.textFieldBuilder(),
          (b) => b.withMinLength(8),
        ),
      'abc',
    ],
    [
      'maxlength',
      () =>
        kindOf(
          'textfield',
          () => CedarBuilders.textFieldBuilder(),
          (b) => b.withMaxLength(2),
        ),
      'abcdef',
    ],
    [
      'pattern',
      () =>
        kindOf(
          'textfield',
          () => CedarBuilders.textFieldBuilder(),
          (b) => b.withRegex('^[A-Z]+$'),
        ),
      'lower',
    ],
    [
      'max',
      () =>
        kindOf(
          'numeric',
          () => CedarBuilders.numericFieldBuilder(),
          (b) => b.withNumberType(NumberType.INT).withMaxValue(10),
        ),
      '99',
    ],
    [
      'min',
      () =>
        kindOf(
          'numeric',
          () => CedarBuilders.numericFieldBuilder(),
          (b) => b.withNumberType(NumberType.INT).withMinValue(10),
        ),
      '1',
    ],
  ])('%s', (alias, make, value) => {
    expect(Object.keys(failuresFor(make(), value))).toContain(alias);
  });

  /**
   * The external authority types, and the thing to be careful about with them.
   *
   * These tests say what happens when the *stored value* of such a field is not
   * a well-formed IRI, which is a real question the data quality report asks of
   * an injected instance. They say nothing about the widget, and an earlier
   * version of this block was read as though they did: the adapter was wired
   * into the seven authority widgets on the strength of it, and shipped an
   * error on the first keystroke of every one of them.
   *
   * The gap is that those widgets' controls hold *search text*, not the value.
   * `errorsFor(..., 'not-an-iri')` is a fair question about a value and a
   * meaningless one about a half-typed name. Nothing here could have caught the
   * difference, because nothing here knows what the control contains — which is
   * why the behaviour is now covered in `visual/tests/render.spec.ts` against
   * the real widgets in a browser.
   */
  it.each([
    ['ext-orcid', () => CedarBuilders.extOrcidFieldBuilder(), 'invalidOrcid'],
    ['ext-ror', () => CedarBuilders.extRorFieldBuilder(), 'invalidRor'],
    ['ext-pfas', () => CedarBuilders.extPfasFieldBuilder(), 'invalidPfas'],
    ['ext-pubmed', () => CedarBuilders.extPubmedFieldBuilder(), 'invalidPmid'],
    ['ext-rrid', () => CedarBuilders.extRridFieldBuilder(), 'invalidRrid'],
    ['ext-nih-grant-id', () => CedarBuilders.extNihGrantIdFieldBuilder(), 'invalidNihGrant'],
    ['ext-doi', () => CedarBuilders.extDoiFieldBuilder(), 'invalidDoi'],
  ])('a stored %s value that is not an IRI reports %s', (inputType, make, key) => {
    const errors = failuresFor(kindOf(inputType, make), 'not-an-iri');
    expect(Object.keys(errors)).toContain(key);
    expect(Object.keys(errors)).toContain('iriMalformed');
  });

  it('accepts a well-formed authority IRI', () => {
    expect(
      errorsFor(
        kindOf('ext-doi', () => CedarBuilders.extDoiFieldBuilder()),
        'https://doi.org/10.1000/x',
      ),
    ).toBeNull();
  });
});

describe('error details', () => {
  it('carries the validator message and the offending value', () => {
    const kind = kindOf(
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(NumberType.INT).withMaxValue(10),
    );
    const errors = failuresFor(kind, '99');
    expect(errors['maxValue'].message).toContain('10');
    expect(errors['maxValue'].value).toBe('99');
  });

  it('exposes the first message for a template to render', () => {
    const kind = kindOf('email', () => CedarBuilders.emailFieldBuilder());
    const control: any = { errors: errorsFor(kind, 'nope') };
    expect(CedarValidators.firstMessage(control)).toContain('email');
  });

  it('returns no message when the control is clean', () => {
    expect(CedarValidators.firstMessage({ errors: null } as any)).toBeNull();
  });
});

describe('numeric hint text', () => {
  /**
   * The numeric widget prints this beside the field. It lives next to the
   * validator so the description and the pattern applied cannot disagree —
   * which they could when the message was assembled in the component.
   */
  it.each([
    [NumberType.INT, 'integer'],
    [NumberType.LONG, 'long integer'],
    [NumberType.BYTE, 'byte'],
    [NumberType.SHORT, 'short'],
    [NumberType.FLOAT, 'float'],
    [NumberType.DOUBLE, 'double'],
    [NumberType.DECIMAL, 'decimal'],
  ])('describes %s', (type, expected) => {
    const kind = kindOf(
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(type),
    );
    expect(CedarValidators.describeNumberType(componentFor(kind))).toContain(expected);
  });

  it('mentions the decimal limit when one is declared', () => {
    const kind = kindOf(
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(NumberType.DOUBLE).withDecimalPlaces(3),
    );
    expect(CedarValidators.describeNumberType(componentFor(kind))).toContain('3 decimal places');
  });

  /**
   * A fractional type allowed no fractional part is a whole number, so naming the type
   * states the opposite of the constraint: `a decimal with at most 0 decimal places`
   * reads as a contradiction.
   */
  it('describes zero declared places as a number rather than as its type', () => {
    const kind = kindOf(
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(NumberType.DECIMAL).withDecimalPlaces(0),
    );
    expect(CedarValidators.describeNumberType(componentFor(kind))).toBe(
      'The value should be a number with no decimal places.',
    );
  });

  it('matches the noun to the count when only one place is allowed', () => {
    const kind = kindOf(
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(NumberType.DOUBLE).withDecimalPlaces(1),
    );
    expect(CedarValidators.describeNumberType(componentFor(kind))).toContain('1 decimal place.');
  });

  /**
   * The widget prints this as it stands. Every branch used to open with a space and end
   * without its own period, leaving the rendered line indented under the error above it
   * and closed with two — and a float with no decimal place declared trailed a comma
   * into nothing.
   */
  it.each([
    [NumberType.INT, undefined],
    [NumberType.LONG, undefined],
    [NumberType.BYTE, undefined],
    [NumberType.SHORT, undefined],
    [NumberType.FLOAT, undefined],
    [NumberType.DOUBLE, undefined],
    [NumberType.DECIMAL, 2],
  ])('reads as a finished sentence for %s', (type, decimals) => {
    const kind = kindOf(
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => (decimals == null ? b.withNumberType(type) : b.withNumberType(type).withDecimalPlaces(decimals)),
    );

    const message = CedarValidators.describeNumberType(componentFor(kind))!;

    expect(message).toMatch(/^[^\s].*[^.,]\.$/);
  });
});

describe('checkbox groups', () => {
  /**
   * `Validators.required` on a FormGroup passes as soon as the group exists, so
   * it cannot express "at least one ticked". That is why the checkbox widget
   * carried no validator at all and a required checkbox field never showed as
   * unsatisfied, even though the report counted it.
   */
  const validate = (value: unknown) => CedarValidators.atLeastOneChecked()({ value } as any);

  it('rejects a group with nothing ticked', () => {
    expect(validate({ Alpha: false, Beta: false })).not.toBeNull();
  });

  it('accepts a group with one ticked', () => {
    expect(validate({ Alpha: false, Beta: true })).toBeNull();
  });

  it('rejects an empty group', () => {
    expect(validate({})).not.toBeNull();
  });
});
