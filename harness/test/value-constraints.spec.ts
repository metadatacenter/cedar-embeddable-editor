/**
 * Value constraints: the type-specific half of the model.
 *
 * `TemplateRepresentationFactory.extractValueConstraints` fans a template's
 * `_valueConstraints` out into four separate info objects on the component —
 * `valueInfo`, `numberInfo`, `choiceInfo`, `controlledInfo`. Controlled terms
 * get their own suite; this one covers the rest.
 *
 * The choice-literal cases matter most. `selectedByDefault` is not display
 * metadata: `DataObjectBuilderHandler.buildRecursively` reads it and pre-seeds
 * the instance with those values, so a template with a default-selected option
 * produces a non-empty instance before the user touches anything.
 *
 * Dimensions and their frequency in the HuBMAP corpus shipped with
 * cedar-artifact-library (`src/test/resources/templates-yaml/`): values 601,
 * regex 150, minValue 127, default 96, selected 37, granularity 28.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, NumberType, TemporalGranularity, TemporalType } from 'cedar-model-typescript-library';
import { FIELD_KINDS, FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { instanceWith, literalOf, literalValue, templateIdOf, termOf, xsdTypeOf } from '../src/values';

const kindOf = (
  key: string,
  inputType: string,
  make: () => any,
  configure?: (b: any) => any,
  write: FieldKind['write'] = 'value',
  sample = 'x',
): FieldKind => ({ key, inputType, make, isStatic: false, write, sample, configure });

const drive = (kind: FieldKind, name = 'f') =>
  new CeeDriver(buildTemplate({ name: `vc_${kind.key}`, children: [{ kind, name }] }));

describe('text constraints', () => {
  it('carries minLength and maxLength onto valueInfo', () => {
    const kind = kindOf(
      'textlen',
      'textfield',
      () => CedarBuilders.textFieldBuilder(),
      (b) => b.withMinLength(3).withMaxLength(42),
    );
    const info = drive(kind).findOrThrow(['_f']).valueInfo;
    expect(info.minLength).toBe(3);
    expect(info.maxLength).toBe(42);
  });

  it('carries a default value onto valueInfo', () => {
    const kind = kindOf(
      'textdef',
      'textfield',
      () => CedarBuilders.textFieldBuilder(),
      (b) => b.withDefaultValue('preset'),
    );
    expect(drive(kind).findOrThrow(['_f']).valueInfo.defaultValue).toBe('preset');
  });

  it('seeds a ChildSpec literal default before any widget exists', () => {
    const text = FIELD_KINDS.find((kind) => kind.key === 'text')!;
    const template = buildTemplate({
      name: 'vc_child_literal_default',
      children: [{ kind: text, name: 'f', defaultValue: 'preset' }],
    });

    expect(literalOf(new CeeDriver(template).extract.values._f)).toBe('preset');
  });

  it('does not replace an explicit empty value in a host-supplied instance', () => {
    const text = FIELD_KINDS.find((kind) => kind.key === 'text')!;
    const template = buildTemplate({
      name: 'vc_supplied_blank_default',
      children: [{ kind: text, name: 'f', defaultValue: 'preset' }],
    });
    const driver = new CeeDriver(template, {
      instance: instanceWith(templateIdOf(template), { _f: literalValue(null) }),
    });

    expect(literalOf(driver.extract.values._f)).toBeNull();
  });

  /**
   * `regex` is the second most common constraint in the HuBMAP corpus (150
   * uses) and was read by nothing: `ValueInfo` had no slot for it and no
   * validator applied it. Both are now in place.
   */
  it('surfaces regex on valueInfo', () => {
    const kind = kindOf(
      'textre',
      'textfield',
      () => CedarBuilders.textFieldBuilder(),
      (b) => b.withRegex('^[A-Z]{3}$'),
    );
    const component = drive(kind).findOrThrow(['_f']);
    expect(component.basicInfo.inputType).toBe('textfield');
    expect(component.valueInfo.regex).toBe('^[A-Z]{3}$');
  });

  it('reports a value that violates the regex, and accepts one that matches', () => {
    const kind = kindOf(
      'textre2',
      'textfield',
      () => CedarBuilders.textFieldBuilder(),
      (b) => b.withRegex('^[A-Z]{3}$'),
    );
    const bad = drive(kind);
    bad.setValue(['_f'], kind, 'zzz');
    expect(bad.qualityReport.isValid).toBe(false);
    expect(bad.qualityReport.problems.map((p: any) => p.code)).toContain('regex');

    const good = drive(kind);
    good.setValue(['_f'], kind, 'ZZZ');
    expect(good.qualityReport.isValid).toBe(true);
  });
});

describe('controlled defaults', () => {
  it('seeds the IRI and label pair from ChildSpec even when the field is hidden', () => {
    const controlled = FIELD_KINDS.find((kind) => kind.key === 'controlled')!;
    const template = buildTemplate({
      name: 'vc_child_term_default',
      children: [
        {
          kind: controlled,
          name: 'f',
          hidden: true,
          defaultValue: {
            iri: 'http://purl.obolibrary.org/obo/NCBITaxon_9606',
            label: 'Homo sapiens',
          },
        },
      ],
    });

    expect(termOf(new CeeDriver(template).extract.values._f)).toEqual({
      iri: 'http://purl.obolibrary.org/obo/NCBITaxon_9606',
      label: 'Homo sapiens',
    });
  });
});

describe('numeric constraints', () => {
  const numberTypes = [
    ['BYTE', NumberType.BYTE],
    ['SHORT', NumberType.SHORT],
    ['INT', NumberType.INT],
    ['LONG', NumberType.LONG],
    ['FLOAT', NumberType.FLOAT],
    ['DOUBLE', NumberType.DOUBLE],
    ['DECIMAL', NumberType.DECIMAL],
  ] as const;

  it.each(numberTypes.map(([n, t]) => [n, t] as const))('numberType %s reaches numberInfo', (name, type) => {
    const kind = kindOf(
      `num_${name}`,
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(type),
    );
    const info = drive(kind).findOrThrow(['_f']).numberInfo;
    expect(info.numberType, `numberType missing for ${name}`).toBeTruthy();
  });

  it('carries minValue, maxValue, decimalPlaces and unitOfMeasure', () => {
    const kind = kindOf(
      'num_full',
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) =>
        b
          .withNumberType(NumberType.DOUBLE)
          .withMinValue(0)
          .withMaxValue(100)
          .withDecimalPlaces(2)
          .withUnitOfMeasure('mm'),
    );
    const info = drive(kind).findOrThrow(['_f']).numberInfo;
    expect(info.minValue).toBe(0);
    expect(info.maxValue).toBe(100);
    expect(info.decimalPlace).toBe(2);
    expect(info.unitOfMeasure).toBe('mm');
  });

  /**
   * `minValue: 0` is the interesting one — a falsy number that a truthiness
   * check would silently drop. It appears 127 times in the corpus.
   */
  it('preserves a zero minValue rather than treating it as absent', () => {
    const kind = kindOf(
      'num_zero',
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(NumberType.INT).withMinValue(0),
    );
    expect(drive(kind).findOrThrow(['_f']).numberInfo.minValue).toBe(0);
  });

  it.each<[string, NumberType, number]>([
    ['BYTE', NumberType.BYTE, -128],
    ['SHORT', NumberType.SHORT, 32767],
    ['INT', NumberType.INT, 2147483647],
    ['LONG', NumberType.LONG, Number.MAX_SAFE_INTEGER],
    ['FLOAT', NumberType.FLOAT, 3.4e38],
    ['DOUBLE', NumberType.DOUBLE, 1e300],
    ['DECIMAL', NumberType.DECIMAL, 42.5],
  ])('seeds a valid %s default as its typed literal', (_name, numberType, defaultValue) => {
    const numeric = kindOf(
      `num_default_${_name}`,
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(numberType),
    );
    const template = buildTemplate({
      name: `vc_num_default_${_name}`,
      children: [{ kind: numeric, name: 'f', defaultValue }],
    });
    const driver = new CeeDriver(template);

    expect(driver.findOrThrow(['_f']).valueInfo.defaultValue).toBe(defaultValue);
    expect(literalOf(driver.extract.values._f)).toBe(String(defaultValue));
    expect(xsdTypeOf(driver.extract.values._f)).toBe(numberType.getValue());
  });
});

describe('temporal constraints', () => {
  const granularities = [
    ['YEAR', TemporalGranularity.YEAR],
    ['MONTH', TemporalGranularity.MONTH],
    ['DAY', TemporalGranularity.DAY],
    ['HOUR', TemporalGranularity.HOUR],
    ['MINUTE', TemporalGranularity.MINUTE],
    ['SECOND', TemporalGranularity.SECOND],
    ['DECIMAL_SECOND', TemporalGranularity.DECIMAL_SECOND],
  ] as const;

  it.each(granularities.map(([n, g]) => [n, g] as const))('granularity %s reaches basicInfo', (name, granularity) => {
    const kind = kindOf(
      `tg_${name}`,
      'temporal',
      () => CedarBuilders.temporalFieldBuilder(),
      (b) => b.withTemporalType(TemporalType.DATETIME).withTemporalGranularity(granularity),
    );
    const component = drive(kind).findOrThrow(['_f']);
    expect(component.basicInfo.inputType).toBe('temporal');
    expect(component.basicInfo.temporalGranularity, `granularity missing for ${name}`).toBeTruthy();
  });

  it.each([
    ['DATE', TemporalType.DATE],
    ['TIME', TemporalType.TIME],
    ['DATETIME', TemporalType.DATETIME],
  ] as const)('temporalType %s reaches valueInfo', (name, type) => {
    const kind = kindOf(
      `tt_${name}`,
      'temporal',
      () => CedarBuilders.temporalFieldBuilder(),
      (b) => b.withTemporalType(type).withTemporalGranularity(TemporalGranularity.DAY),
    );
    expect(drive(kind).findOrThrow(['_f']).valueInfo.temporalType, `temporalType missing for ${name}`).toBeTruthy();
  });

  it('carries timezoneEnabled', () => {
    const kind = kindOf(
      'tz',
      'temporal',
      () => CedarBuilders.temporalFieldBuilder(),
      (b) =>
        b
          .withTemporalType(TemporalType.DATETIME)
          .withTemporalGranularity(TemporalGranularity.MINUTE)
          .withTimezoneEnabled(true),
    );
    expect(drive(kind).findOrThrow(['_f']).basicInfo.timezoneEnabled).toBe(true);
  });

  it.each<[string, TemporalType, TemporalGranularity, string, string]>([
    ['date/year', TemporalType.DATE, TemporalGranularity.YEAR, '2026', '2026-01-01'],
    ['date/month', TemporalType.DATE, TemporalGranularity.MONTH, '2026-08', '2026-08-01'],
    ['date/day', TemporalType.DATE, TemporalGranularity.DAY, '2024-02-29', '2024-02-29'],
    ['time/hour', TemporalType.TIME, TemporalGranularity.HOUR, '14', '14:00:00'],
    ['time/minute', TemporalType.TIME, TemporalGranularity.MINUTE, '14:30', '14:30:00'],
    ['time/second', TemporalType.TIME, TemporalGranularity.SECOND, '14:30:45', '14:30:45'],
    ['time/decimalSecond', TemporalType.TIME, TemporalGranularity.DECIMAL_SECOND, '14:30:45.125', '14:30:45.125'],
    ['dateTime/day', TemporalType.DATETIME, TemporalGranularity.DAY, '2026-08-20', '2026-08-20T00:00:00'],
    ['dateTime/hour', TemporalType.DATETIME, TemporalGranularity.HOUR, '2026-08-20T14', '2026-08-20T14:00:00'],
    ['dateTime/minute', TemporalType.DATETIME, TemporalGranularity.MINUTE, '2026-08-20T14:30', '2026-08-20T14:30:00'],
    ['dateTime/second', TemporalType.DATETIME, TemporalGranularity.SECOND, '2026-08-20T14:30:45', '2026-08-20T14:30:45'],
    [
      'dateTime/decimalSecond',
      TemporalType.DATETIME,
      TemporalGranularity.DECIMAL_SECOND,
      '2026-08-20T14:30:45.125',
      '2026-08-20T14:30:45.125',
    ],
  ])('seeds a %s default in complete instance form', (_name, temporalType, granularity, declared, stored) => {
    const temporal = kindOf(
      `temporal_default_${_name}`,
      'temporal',
      () => CedarBuilders.temporalFieldBuilder(),
      (b) => b.withTemporalType(temporalType).withTemporalGranularity(granularity),
    );
    const template = buildTemplate({
      name: `vc_temporal_default_${_name}`,
      children: [{ kind: temporal, name: 'f', defaultValue: declared }],
    });
    const driver = new CeeDriver(template);

    expect(driver.findOrThrow(['_f']).valueInfo.defaultValue).toBe(declared);
    expect(literalOf(driver.extract.values._f)).toBe(stored);
    expect(xsdTypeOf(driver.extract.values._f)).toBe(temporalType.getValue());
  });
});

describe('choice literals', () => {
  const choiceKinds = [
    ['listSingle', 'list', () => CedarBuilders.singleChoiceListFieldBuilder(), 'addListOption'],
    ['listMulti', 'list', () => CedarBuilders.multipleChoiceListFieldBuilder(), 'addListOption'],
    ['radio', 'radio', () => CedarBuilders.radioFieldBuilder(), 'addRadioOption'],
    ['checkbox', 'checkbox', () => CedarBuilders.checkboxFieldBuilder(), 'addCheckboxOption'],
  ] as const;

  const withOptions =
    (method: string, options: Array<[string, boolean]>) =>
    (b: any): any => {
      let out = b;
      for (const [label, selected] of options) out = out[method](label, selected);
      return out;
    };

  it.each(choiceKinds.map(([key, it_, make, m]) => [key, it_, make, m] as const))(
    '%s exposes its literals as choiceInfo.choices',
    (key, inputType, make, method) => {
      const kind = kindOf(
        `ch_${key}`,
        inputType,
        make,
        withOptions(method, [
          ['Alpha', false],
          ['Beta', false],
          ['Gamma', false],
        ]),
      );
      const info = drive(kind).findOrThrow(['_f']).choiceInfo;
      expect(info.choices).toHaveLength(3);
      expect(info.choices.map((c: any) => c.label)).toEqual(['Alpha', 'Beta', 'Gamma']);
      // `selectedByDefault: false` is omitted from the emitted template rather
      // than written explicitly, so CEE reads it as undefined. Both are falsy
      // and every consumer tests truthiness, so this is a representation
      // detail — but asserting `=== false` here would be wrong.
      expect(info.choices.every((c: any) => !c.selectedByDefault)).toBe(true);
    },
  );

  it.each(choiceKinds.map(([key, it_, make, m]) => [key, it_, make, m] as const))(
    '%s marks the default-selected literal',
    (key, inputType, make, method) => {
      const kind = kindOf(
        `chd_${key}`,
        inputType,
        make,
        withOptions(method, [
          ['Alpha', false],
          ['Beta', true],
        ]),
      );
      const choices = drive(kind).findOrThrow(['_f']).choiceInfo.choices;
      expect(choices.find((c: any) => c.label === 'Beta').selectedByDefault).toBe(true);
      expect(choices.find((c: any) => c.label === 'Alpha').selectedByDefault).toBeFalsy();
    },
  );

  /**
   * The behavioural consequence: `DataObjectBuilderHandler.buildRecursively`
   * seeds a multi field's value wrappers from `selectedByDefault`, so the
   * instance is non-empty before any user interaction.
   *
   * Reaching it needs `minItems > 0` (data-object-builder.handler.ts:96), and
   * for a checkbox that means marking the field required. Checkbox and
   * multiple-choice-list fields are multiple by nature, so their deployment
   * builder has no `withMinItems`; what a template carries for them is derived
   * from `requiredValue` — one when required, zero otherwise — and both this
   * library and the Java one write it that way. Injecting `minItems` into the
   * JSON by hand reaches the same code, but only under CEE's own JSON walk:
   * the model library ignores a declared bound on an always-multiple child in
   * favour of the derivation. Required is the realistic route and it works
   * whichever parser is underneath.
   */
  it('pre-seeds the instance from a default-selected literal on a multi field', () => {
    const kind = kindOf(
      'seed',
      'checkbox',
      () => CedarBuilders.checkboxFieldBuilder(),
      (b) => b.addCheckboxOption('Alpha', false).addCheckboxOption('Beta', true),
    );
    const template = buildTemplate({ name: 'vc_seed', children: [{ kind, name: 'f', required: true }] });
    const driver = new CeeDriver(template);

    const seeded = driver.extract.values._f;
    expect(Array.isArray(seeded), 'field did not build as a multi field').toBe(true);
    expect(JSON.stringify(seeded)).toContain('Beta');
    expect(JSON.stringify(seeded), 'unselected literal should not be seeded').not.toContain('Alpha');
  });

  it('leaves the instance unseeded when no literal is default-selected', () => {
    const kind = kindOf(
      'noseed',
      'checkbox',
      () => CedarBuilders.checkboxFieldBuilder(),
      (b) => b.addCheckboxOption('Alpha', false).addCheckboxOption('Beta', false),
    );
    const template = buildTemplate({ name: 'vc_noseed', children: [{ kind, name: 'f', required: true }] });
    const driver = new CeeDriver(template);

    expect(JSON.stringify(driver.extract.values._f)).not.toContain('Beta');
  });

  it('seeds an optional field because its declared default is an occurrence', () => {
    const checkbox = FIELD_KINDS.find((kind) => kind.key === 'checkbox')!;
    const driver = new CeeDriver(
      buildTemplate({
        name: 'vc_nomin',
        children: [
          {
            kind: checkbox,
            name: 'f',
            options: [{ label: 'Alpha' }, { label: 'Beta' }],
            defaultValue: 'Beta',
          },
        ],
      }),
    );

    const values = driver.extract.values._f as unknown[];
    expect(values).toHaveLength(1);
    expect(literalOf(values[0])).toBe('Beta');
  });
});

describe('constraints survive a save/reload cycle', () => {
  /**
   * Constraints live on the template, not the instance, so reloading must
   * re-derive them from the template rather than the saved data. A regression
   * that dropped them would leave the widget rendering without its bounds.
   */
  it('numeric bounds are re-derived after reload', () => {
    const kind = kindOf(
      'rl_num',
      'numeric',
      () => CedarBuilders.numericFieldBuilder(),
      (b) => b.withNumberType(NumberType.INT).withMinValue(1).withMaxValue(9),
    );
    const template = buildTemplate({ name: 'vc_rl_num', children: [{ kind, name: 'f' }] });

    const first = new CeeDriver(template);
    first.setValue(['_f'], kind, '5');

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    const info = reloaded.findOrThrow(['_f']).numberInfo;
    expect(info.minValue).toBe(1);
    expect(info.maxValue).toBe(9);
    reloaded.expectNoErrors('numeric reload');
  });

  it('choice literals are re-derived after reload', () => {
    const kind = kindOf(
      'rl_ch',
      'radio',
      () => CedarBuilders.radioFieldBuilder(),
      (b) => b.addRadioOption('Alpha', false).addRadioOption('Beta', true),
    );
    const template = buildTemplate({ name: 'vc_rl_ch', children: [{ kind, name: 'f' }] });

    const first = new CeeDriver(template);
    const reloaded = new CeeDriver(template, { instance: first.metadata });

    expect(reloaded.findOrThrow(['_f']).choiceInfo.choices).toHaveLength(2);
  });
});
