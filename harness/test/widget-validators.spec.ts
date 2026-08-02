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

/** Run the adapter the way Angular would. */
const errorsFor = (kind: FieldKind, value: unknown): Record<string, any> | null =>
  CedarValidators.forComponent(componentFor(kind))({ value } as any) as any;

describe('the adapter reports the same problems as the report', () => {
  it.each([
    ['a malformed email', () => kindOf('email', () => CedarBuilders.emailFieldBuilder()), 'not-an-email', 'email'],
    [
      'text under minLength',
      () => kindOf('textfield', () => CedarBuilders.textFieldBuilder(), (b) => b.withMinLength(8)),
      'abc',
      'minLength',
    ],
    [
      'a regex mismatch',
      () => kindOf('textfield', () => CedarBuilders.textFieldBuilder(), (b) => b.withRegex('^[A-Z]{3}$')),
      'zzz',
      'regex',
    ],
    [
      'a numeric type mismatch',
      () => kindOf('numeric', () => CedarBuilders.numericFieldBuilder(), (b) => b.withNumberType(NumberType.INT)),
      '3.7',
      'numberType',
    ],
    [
      'a numeric out of range',
      () =>
        kindOf('numeric', () => CedarBuilders.numericFieldBuilder(), (b) =>
          b.withNumberType(NumberType.INT).withMaxValue(10),
        ),
      '999',
      'maxValue',
    ],
  ])('%s produces the %s error', (_label, make, value, code) => {
    expect(Object.keys(errorsFor(make(), value))).toContain(code);
  });

  it('returns null for a value that satisfies every constraint', () => {
    const kind = kindOf('email', () => CedarBuilders.emailFieldBuilder());
    expect(errorsFor(kind, 'someone@example.org')).toBeNull();
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
      () => kindOf('textfield', () => CedarBuilders.textFieldBuilder(), (b) => b.withMinLength(8)),
      'abc',
    ],
    [
      'maxlength',
      () => kindOf('textfield', () => CedarBuilders.textFieldBuilder(), (b) => b.withMaxLength(2)),
      'abcdef',
    ],
    [
      'pattern',
      () => kindOf('textfield', () => CedarBuilders.textFieldBuilder(), (b) => b.withRegex('^[A-Z]+$')),
      'lower',
    ],
    [
      'max',
      () =>
        kindOf('numeric', () => CedarBuilders.numericFieldBuilder(), (b) =>
          b.withNumberType(NumberType.INT).withMaxValue(10),
        ),
      '99',
    ],
    [
      'min',
      () =>
        kindOf('numeric', () => CedarBuilders.numericFieldBuilder(), (b) =>
          b.withNumberType(NumberType.INT).withMinValue(10),
        ),
      '1',
    ],
  ])('%s', (alias, make, value) => {
    expect(Object.keys(errorsFor(make(), value))).toContain(alias);
  });

  /**
   * PFAS, PubMed, RRID, NIH Grant and DOI each render a `mat-error` bound to a
   * type-specific key that nothing ever set — copied from the ORCID/ROR pair
   * without the code that raises it. Mapping `iriMalformed` onto those keys
   * brings the existing markup to life.
   */
  it.each([
    ['ext-orcid', () => CedarBuilders.extOrcidFieldBuilder(), 'invalidOrcid'],
    ['ext-ror', () => CedarBuilders.extRorFieldBuilder(), 'invalidRor'],
    ['ext-pfas', () => CedarBuilders.extPfasFieldBuilder(), 'invalidPfas'],
    ['ext-pubmed', () => CedarBuilders.extPubmedFieldBuilder(), 'invalidPmid'],
    ['ext-rrid', () => CedarBuilders.extRridFieldBuilder(), 'invalidRrid'],
    ['ext-nih-grant-id', () => CedarBuilders.extNihGrantIdFieldBuilder(), 'invalidNihGrant'],
    ['ext-doi', () => CedarBuilders.extDoiFieldBuilder(), 'invalidDoi'],
  ])('%s sets %s, which its template already listens for', (inputType, make, key) => {
    const errors = errorsFor(kindOf(inputType, make), 'not-an-iri');
    expect(Object.keys(errors)).toContain(key);
    expect(Object.keys(errors)).toContain('iriMalformed');
  });

  it('accepts a well-formed authority IRI', () => {
    expect(errorsFor(kindOf('ext-doi', () => CedarBuilders.extDoiFieldBuilder()), 'https://doi.org/10.1000/x')).toBeNull();
  });
});

describe('error details', () => {
  it('carries the validator message and the offending value', () => {
    const kind = kindOf('numeric', () => CedarBuilders.numericFieldBuilder(), (b) =>
      b.withNumberType(NumberType.INT).withMaxValue(10),
    );
    const errors = errorsFor(kind, '99');
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
    const kind = kindOf('numeric', () => CedarBuilders.numericFieldBuilder(), (b) => b.withNumberType(type));
    expect(CedarValidators.describeNumberType(componentFor(kind))).toContain(expected);
  });

  it('mentions the decimal limit when one is declared', () => {
    const kind = kindOf('numeric', () => CedarBuilders.numericFieldBuilder(), (b) =>
      b.withNumberType(NumberType.DOUBLE).withDecimalPlaces(3),
    );
    expect(CedarValidators.describeNumberType(componentFor(kind))).toContain('3 decimals');
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
