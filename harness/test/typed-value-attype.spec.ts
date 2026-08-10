/**
 * A numeric or temporal value keeps its `@type` when the user edits it.
 *
 * These are the two field kinds whose instance value is a *typed* literal:
 * `{'@value': …, '@type': 'xsd:dateTime'}`, not a bare `{'@value': …}`. CEDAR's
 * instance schema makes that `@type` required for a temporal field, so an
 * instance that carries the value without it is rejected on save — the value the
 * user just entered is lost.
 *
 * The initial structure build attaches the `@type` (via
 * `DataObjectUtil.xsdTypeForFullCopy`, in the full copy). Writing a value used to
 * drop it: `changeValue` rebuilt the value node as a bare literal. The round-trip
 * and corpus suites never caught it because they assert the *extract*, which
 * carries no `@type` by design — the type lives only in the full copy the host
 * saves. This pins the full copy, through the real serializer the host reads.
 */
import { describe, expect, it } from 'vitest';
import {
  CedarBuilders,
  CedarWriters,
  TemporalType,
  TemporalGranularity,
  NumberType,
} from 'cedar-model-typescript-library';
import { InstanceSerializer } from '@cee/util/instance-serializer';
import { FIELD_KINDS } from '../src/axes';
import { CeeDriver } from '../src/driver';
import { literalNode } from '../src/values';

const TEMPORAL = FIELD_KINDS.find((k) => k.key === 'temporal')!;
const NUMERIC = FIELD_KINDS.find((k) => k.key === 'numeric')!;
const TEXT = FIELD_KINDS.find((k) => k.key === 'text')!;

/** A template carrying a dateTime field, a decimal field, and a plain text field. */
const typedTemplate = (): object => {
  const dt = CedarBuilders.temporalFieldBuilder()
    .withAtId('https://repo.metadatacenter.org/template-fields/when')
    .withTitle('When')
    .withDescription('when')
    .withSchemaName('When')
    .withSchemaDescription('when')
    .withTemporalType(TemporalType.DATETIME)
    .withTemporalGranularity(TemporalGranularity.MINUTE)
    .withTimezoneEnabled(true)
    .build();
  const num = CedarBuilders.numericFieldBuilder()
    .withAtId('https://repo.metadatacenter.org/template-fields/count')
    .withTitle('Count')
    .withDescription('count')
    .withSchemaName('Count')
    .withSchemaDescription('count')
    .withNumberType(NumberType.DECIMAL)
    .build();
  const text = CedarBuilders.textFieldBuilder()
    .withAtId('https://repo.metadatacenter.org/template-fields/note')
    .withTitle('Note')
    .withDescription('note')
    .withSchemaName('Note')
    .withSchemaDescription('note')
    .build();

  const dep = (artifact: any, prop: string) =>
    artifact.createDeploymentBuilder(prop).withIri(`https://schema.metadatacenter.org/properties/${prop}`).build();

  const template = CedarBuilders.templateBuilder()
    .withAtId('https://repo.metadatacenter.org/templates/typed')
    .withTitle('Typed')
    .withDescription('typed')
    .withSchemaName('Typed')
    .withSchemaDescription('typed schema')
    .addChild(dt, dep(dt, '_when'))
    .addChild(num, dep(num, '_count'))
    .addChild(text, dep(text, '_note'))
    .build();

  const writer = CedarWriters.json().getStrict().getTemplateWriter();
  return JSON.parse(JSON.stringify(writer.getAsJsonNode(template)));
};

const json = (driver: CeeDriver): Record<string, any> =>
  InstanceSerializer.toJson(driver.instance) as Record<string, any>;

const filled = (): CeeDriver => {
  const driver = new CeeDriver(typedTemplate());
  driver.setValue(['_when'], TEMPORAL, '2026-08-01T13:30:00-07:00');
  driver.setValue(['_count'], NUMERIC, '42');
  driver.setValue(['_note'], TEXT, 'plain');
  driver.expectNoErrors('typed writes');
  return driver;
};

describe('an edited typed value carries its @type in the full copy', () => {
  it('a temporal value carries @type xsd:dateTime', () => {
    expect(json(filled())._when).toEqual(literalNode('2026-08-01T13:30:00-07:00', 'xsd:dateTime'));
  });

  it('a numeric value carries @type xsd:decimal', () => {
    expect(json(filled())._count).toEqual(literalNode('42', 'xsd:decimal'));
  });

  it('a plain text value carries no @type', () => {
    expect(json(filled())._note).toEqual(literalNode('plain'));
  });

  it('survives a save-then-reload round-trip', () => {
    const saved = json(filled());
    const reloaded = json(new CeeDriver(typedTemplate(), { instance: saved }));
    expect(reloaded._when).toEqual(literalNode('2026-08-01T13:30:00-07:00', 'xsd:dateTime'));
    expect(reloaded._count).toEqual(literalNode('42', 'xsd:decimal'));
  });
});

/**
 * `xsd:dateTime` is one of three temporal types, not the whole story. A date-only
 * and a time-only field each carry their own `@type`, and the fix must stamp
 * whichever the field declares rather than a single hardcoded value — so all
 * three are pinned, not just the one the original report happened to use.
 */
describe('each temporal type stamps its own @type', () => {
  const temporalTemplate = (temporalType: TemporalType, granularity: TemporalGranularity): object => {
    const f = CedarBuilders.temporalFieldBuilder()
      .withAtId('https://repo.metadatacenter.org/template-fields/when')
      .withTitle('When')
      .withDescription('when')
      .withSchemaName('When')
      .withSchemaDescription('when')
      .withTemporalType(temporalType)
      .withTemporalGranularity(granularity)
      .withTimezoneEnabled(true)
      .build();
    const template = CedarBuilders.templateBuilder()
      .withAtId('https://repo.metadatacenter.org/templates/temporal')
      .withTitle('Temporal')
      .withDescription('temporal')
      .withSchemaName('Temporal')
      .withSchemaDescription('temporal schema')
      .addChild(
        f,
        f.createDeploymentBuilder('_when').withIri('https://schema.metadatacenter.org/properties/_when').build(),
      )
      .build();
    return JSON.parse(JSON.stringify(CedarWriters.json().getStrict().getTemplateWriter().getAsJsonNode(template)));
  };

  const emitted = (temporalType: TemporalType, granularity: TemporalGranularity, value: string) => {
    const driver = new CeeDriver(temporalTemplate(temporalType, granularity));
    driver.setValue(['_when'], TEMPORAL, value);
    driver.expectNoErrors(`temporal ${temporalType}`);
    return json(driver)._when;
  };

  it.each([
    [TemporalType.DATETIME, TemporalGranularity.MINUTE, '2026-08-01T13:30:00-07:00', 'xsd:dateTime'],
    [TemporalType.DATE, TemporalGranularity.DAY, '2026-08-01', 'xsd:date'],
    [TemporalType.TIME, TemporalGranularity.MINUTE, '13:30:00', 'xsd:time'],
  ])('%s value carries @type %s', (temporalType, granularity, value, expectedType) => {
    expect(emitted(temporalType, granularity, value)).toEqual(literalNode(value, expectedType));
  });
});
