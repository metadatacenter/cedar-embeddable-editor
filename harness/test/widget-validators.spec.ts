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
import { CedarBuilders, NumberType, TemporalGranularity, TemporalType } from 'cedar-model-typescript-library';
import { CedarValidators } from '@cee/validation/cedar-validators';
import type { Translatable } from '@cee/models/ui/translatable.model';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

/**
 * What a user reads for a translation key, in one of the two shipped languages.
 *
 * The validators hand the widgets keys, so these tests read the sentences the way a
 * form does: through the language file, with the parameters filled in.
 */
const I18N = path.resolve(__dirname, '../../src/assets/i18n-cee');
const bundle = (lang: 'en' | 'hu'): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(I18N, `${lang}.json`), 'utf8'));
const BUNDLES = { en: bundle('en'), hu: bundle('hu') };
const lookup = (lang: 'en' | 'hu', key: string): string | undefined => {
  let node: unknown = BUNDLES[lang];
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  return typeof node === 'string' ? node : undefined;
};
const read = (text: Translatable | null, lang: 'en' | 'hu' = 'en'): string => {
  if (text === null) {
    return '';
  }
  const template = lookup(lang, text.key);
  if (template === undefined) {
    throw new Error(`${lang}.json has no ${text.key}`);
  }
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => String(text.params?.[name] ?? `{{${name}}}`));
};

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
    expect(read(CedarValidators.describeNumberType(componentFor(kind)))).toContain(expected);
  });

  it('mentions the decimal limit when one is declared', () => {
    const kind = kindOf(
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(NumberType.DOUBLE).withDecimalPlaces(3),
    );
    expect(read(CedarValidators.describeNumberType(componentFor(kind)))).toContain('3 decimal places');
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
    expect(read(CedarValidators.describeNumberType(componentFor(kind)))).toBe(
      'The value should be a number with no decimal places.',
    );
  });

  it('matches the noun to the count when only one place is allowed', () => {
    const kind = kindOf(
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(NumberType.DOUBLE).withDecimalPlaces(1),
    );
    expect(read(CedarValidators.describeNumberType(componentFor(kind)))).toContain('1 decimal place.');
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

    for (const lang of ['en', 'hu'] as const) {
      const message = read(CedarValidators.describeNumberType(componentFor(kind)), lang);

      expect(message).toMatch(/^[^\s].*[^.,]\.$/);
      expect(message, `${lang} left a parameter unfilled`).not.toContain('{{');
    }
  });
});

describe('temporal messages', () => {
  /**
   * The temporal problems carry diagnostics written for the data quality report, such
   * as `Granularity is year, but the padded month or day is not 01.`. The widget used
   * to print those. It now asks for a message by code, phrased for the person typing
   * and in the form's language, while the report keeps its diagnostic.
   */
  const temporal = (type: TemporalType, granularity: TemporalGranularity, timezone = false): FieldKind =>
    kindOf(
      'temporal',
      () => CedarBuilders.temporalFieldBuilder(),
      (b) => b.withTemporalType(type).withTemporalGranularity(granularity).withTimezoneEnabled(timezone),
    );
  const messageFor = (kind: FieldKind, value: string): Translatable =>
    CedarValidators.describeTemporalProblem(
      { errors: failuresFor(kind, value) } as unknown as ValidatedControl,
      componentFor(kind),
    );

  it.each([
    ['a malformed date', temporal(TemporalType.DATE, TemporalGranularity.DAY), 'not a date', 'Enter a valid date.'],
    [
      'a date not in the calendar',
      temporal(TemporalType.DATE, TemporalGranularity.DAY),
      '2023-02-30',
      'Enter a valid date.',
    ],
    ['a malformed time', temporal(TemporalType.TIME, TemporalGranularity.SECOND), 'noon', 'Enter a valid time.'],
    [
      'a malformed date and time',
      temporal(TemporalType.DATETIME, TemporalGranularity.MINUTE),
      'soon',
      'Enter a valid date and time.',
    ],
    [
      'finer information than the field records',
      temporal(TemporalType.DATE, TemporalGranularity.YEAR),
      '2023-05-01',
      'The value does not match the precision this field records.',
    ],
    [
      'an offset on a field that records none',
      temporal(TemporalType.DATETIME, TemporalGranularity.SECOND),
      '2023-08-30T13:02:03-10:00',
      'The value carries a timezone offset, which this field does not record.',
    ],
  ])('asks the user about %s in their terms', (_case, kind, value, expected) => {
    const message = messageFor(kind, value);

    expect(read(message)).toBe(expected);
    expect(read(message, 'hu')).not.toBe(expected);
    expect(read(message, 'hu')).not.toContain('{{');
  });

  it('keeps the diagnostic for the report', () => {
    const kind = temporal(TemporalType.DATE, TemporalGranularity.YEAR);

    expect(failuresFor(kind, '2023-05-01')['temporalGranularity'].message).toContain('Granularity is year');
  });

  it('says a missing value is required, in the words every other widget uses', () => {
    const kind = temporal(TemporalType.DATE, TemporalGranularity.DAY);
    const message = CedarValidators.describeTemporalProblem(
      { errors: { required: true } } as unknown as ValidatedControl,
      componentFor(kind),
    );

    expect(message).toEqual({ key: 'Validation.Required' });
  });
});

describe('checkbox groups', () => {
  /**
   * `Validators.required` on a FormGroup passes as soon as the group exists, so
   * it cannot express "at least one ticked". That is why the checkbox widget
   * carried no validator at all and a required checkbox field never showed as
   * unsatisfied, even though the report counted it.
   *
   * The group is asked through the control that records the selection, and this
   * stub answers as that control does. It used to hand the validator
   * `{ Alpha: false, Beta: true }` — a shape the widget does not produce and
   * never has. The widget writes the string `checked` or null per option, so the
   * validator's `=== true` test could not hold on a real form, and these three
   * checks passed for years over a required field that could never be satisfied.
   *
   * A stub is still the right tool for the rule itself. What it has to be a stub
   * *of* is the thing the widget builds, which is why
   * `cedar-input-checkbox.component.spec.ts` drives the whole path with clicks.
   */
  const selecting = (selection: string[]) =>
    CedarValidators.atLeastOneChecked('checkedChoices')({
      get: (name: string) => (name === 'checkedChoices' ? { value: selection } : null),
    } as any);

  it('rejects a group with nothing ticked', () => {
    expect(selecting([])).not.toBeNull();
  });

  it('accepts a group with one ticked', () => {
    expect(selecting(['Beta'])).toBeNull();
  });

  it('rejects a group whose selection control is missing', () => {
    expect(CedarValidators.atLeastOneChecked('checkedChoices')({ get: () => null } as any)).not.toBeNull();
  });
});
