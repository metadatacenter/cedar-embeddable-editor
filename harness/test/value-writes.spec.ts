/**
 * What a field's slot holds after it is written to, and after it is written
 * over.
 *
 * `DataObjectDataValueHandler` mutates the instance in place — the widgets hold
 * references into it, so the node a field owns is updated rather than replaced.
 * That makes overwriting a distinct question from writing: a slot that held a
 * literal and now holds an IRI has to stop holding the literal, and a slot that
 * held an IRI and now holds a literal has to stop holding the IRI. Neither
 * direction had a test. Mutation testing found the first — deleting the stale
 * `@value` before writing an `@id` could be removed with the whole suite still
 * green.
 *
 * It matters because a value node carrying both `@value` and `@id` is not a
 * shape anything downstream expects: the classifier checks `@value` first, so
 * the stale literal wins and the IRI the user just picked is invisible to the
 * form, to the quality report, and to whatever the host page does with the
 * instance.
 *
 * Reachable through an injected instance: a host page's copy can perfectly well
 * have `{'@value': null}` where CEE's own skeleton would leave `{}`.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, ControlledTermOntologyBuilder, Iri } from 'cedar-model-typescript-library';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import type { InstanceNode } from '@cee/models/instance-node.model';

/**
 * An instance always names the template it is an instance of; there is no
 * valid CEDAR instance without one. Fixtures that stand in for what a host page
 * injects have to be valid instances too.
 */
const TEMPLATE_IRI = 'https://repo.metadatacenter.org/templates/fixture';

const kind = (key: string, inputType: string, make: () => unknown, extra: Partial<FieldKind> = {}): FieldKind =>
  ({ key, inputType, make, isStatic: false, write: 'value', sample: 'x', ...extra }) as FieldKind;

const TEXT = kind('text', 'textfield', () => CedarBuilders.textFieldBuilder());
const LINK = kind('link', 'link', () => CedarBuilders.linkFieldBuilder());
const ORCID = kind('orcid', 'ext-orcid', () => CedarBuilders.extOrcidFieldBuilder());
const CONTROLLED = kind('controlled', 'controlled', () => CedarBuilders.controlledTermFieldBuilder(), {
  write: 'controlled',
  configure: (b: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b as any).addOntology(
      new ControlledTermOntologyBuilder()
        .withAcronym('MESH')
        .withName('Medical Subject Headings')
        .withUri(new Iri('https://data.bioontology.org/ontologies/MESH'))
        .build(),
    ),
});

/** A one-field form, optionally starting from a slot a host page supplied. */
const rig = (fieldKind: FieldKind, startingSlot?: InstanceNode) => {
  const template = buildTemplate({ name: `vw_${fieldKind.key}`, children: [{ kind: fieldKind, name: 'f' }] });
  const driver =
    startingSlot === undefined
      ? new CeeDriver(template)
      : new CeeDriver(template, {
          instance: {
            '@context': {},
            '@id': 'https://example.org/i/1',
            'schema:isBasedOn': TEMPLATE_IRI,
            _f: startingSlot,
          },
        });
  return { driver, component: driver.findOrThrow(['_f']) };
};

describe('writing a value for the first time', () => {
  it('a literal lands as @value', () => {
    const { driver, component } = rig(TEXT);
    driver.handlerContext.changeValue(component, 'typed');
    expect(driver.extract._f).toEqual({ '@value': 'typed' });
  });

  it('a link lands as @id, not @value', () => {
    const { driver, component } = rig(LINK);
    driver.handlerContext.changeValue(component, 'https://example.org/thing');
    expect(driver.extract._f['@id']).toBe('https://example.org/thing');
    expect(Object.hasOwn(driver.extract._f, '@value'), 'a link was written as a literal').toBe(false);
  });

  it('an external authority value lands as @id', () => {
    const { driver, component } = rig(ORCID);
    driver.handlerContext.changeValue(component, 'https://orcid.org/0000-0002-1825-0097');
    expect(driver.extract._f['@id']).toBe('https://orcid.org/0000-0002-1825-0097');
    expect(Object.hasOwn(driver.extract._f, '@value')).toBe(false);
  });

  it('a controlled term lands as @id and label', () => {
    const { driver, component } = rig(CONTROLLED);
    driver.handlerContext.changeControlledValue(component, 'https://x/1', 'One');
    expect(driver.extract._f).toEqual({ '@id': 'https://x/1', 'rdfs:label': 'One' });
  });
});

describe('writing over a slot that already holds something', () => {
  /**
   * REGRESSION SURFACE: the stale `@value` has to go. A node holding both
   * `@value` and `@id` reads back as the literal — the classifier checks
   * `@value` first — so the IRI the user just chose would be invisible
   * everywhere while still sitting in the saved instance.
   */
  it('an IRI replaces a literal rather than joining it', () => {
    const { driver, component } = rig(LINK, { '@value': 'left over' });
    driver.handlerContext.changeValue(component, 'https://example.org/thing');

    expect(driver.extract._f['@id']).toBe('https://example.org/thing');
    expect(Object.hasOwn(driver.extract._f, '@value'), 'the stale literal survived').toBe(false);
  });

  it('a controlled term replaces a literal rather than joining it', () => {
    const { driver, component } = rig(CONTROLLED, { '@value': 'left over' });
    driver.handlerContext.changeControlledValue(component, 'https://x/1', 'One');

    expect(driver.extract._f['@id']).toBe('https://x/1');
    expect(Object.hasOwn(driver.extract._f, '@value'), 'the stale literal survived').toBe(false);
  });

  it('a new IRI replaces the previous one', () => {
    const { driver, component } = rig(CONTROLLED, { '@id': 'https://x/1', 'rdfs:label': 'One' });
    driver.handlerContext.changeControlledValue(component, 'https://x/2', 'Two');
    expect(driver.extract._f).toEqual({ '@id': 'https://x/2', 'rdfs:label': 'Two' });
  });

  it('a new literal replaces the previous one', () => {
    const { driver, component } = rig(TEXT, { '@value': 'first' });
    driver.handlerContext.changeValue(component, 'second');
    expect(driver.extract._f).toEqual({ '@value': 'second' });
  });

  /**
   * The mirror of the first case, and it now holds in both directions.
   *
   * It used not to: writing a literal set `@value` and left any `@id` and
   * `rdfs:label` in place, so the node carried all three. It read back as the
   * literal — the classifier checks `@value` first — so the form and the report
   * agreed with each other while the saved instance still named a term the user
   * had replaced. Only the IRI-over-literal direction was handled.
   *
   * A write now makes the node hold exactly what was written, whichever
   * direction it goes.
   */
  it('a literal replaces an IRI rather than joining it', () => {
    const { driver, component } = rig(TEXT, { '@id': 'https://x/1', 'rdfs:label': 'One' });
    driver.handlerContext.changeValue(component, 'typed');

    expect(driver.extract._f).toEqual({ '@value': 'typed' });
  });
});

describe('clearing a value', () => {
  it('clearing a literal leaves the slot present and empty', () => {
    const { driver, component } = rig(TEXT, { '@value': 'something' });
    driver.handlerContext.changeValue(component, null);
    expect(driver.extract._f).toEqual({ '@value': null });
  });

  it('clearing a controlled term empties it without removing the slot', () => {
    const { driver, component } = rig(CONTROLLED, { '@id': 'https://x/1', 'rdfs:label': 'One' });
    driver.handlerContext.changeControlledValue(component, null, null);
    // `undefined` values do not survive serialisation, so the saved slot is `{}`.
    expect(JSON.parse(JSON.stringify(driver.extract._f))).toEqual({});
  });

  it('clearing a link removes the IRI', () => {
    const { driver, component } = rig(LINK, { '@id': 'https://example.org/thing' });
    driver.handlerContext.changeValue(component, null);
    expect(JSON.parse(JSON.stringify(driver.extract._f))).toEqual({});
  });
});

describe('multi-valued writes', () => {
  const CHECKBOX = kind('checkbox', 'checkbox', () => CedarBuilders.checkboxFieldBuilder(), {
    configure: (b: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (b as any).addCheckboxOption('A').addCheckboxOption('B'),
  });

  it('writes each selection as its own literal', () => {
    const { driver, component } = rig(CHECKBOX);
    driver.handlerContext.changeListValue(component, ['A', 'B']);
    expect(driver.extract._f).toEqual([{ '@value': 'A' }, { '@value': 'B' }]);
  });

  it('replaces the whole list rather than appending', () => {
    const { driver, component } = rig(CHECKBOX);
    driver.handlerContext.changeListValue(component, ['A', 'B']);
    driver.handlerContext.changeListValue(component, ['B']);
    expect(driver.extract._f).toEqual([{ '@value': 'B' }]);
  });

  it('an empty selection writes one empty slot rather than none', () => {
    const { driver, component } = rig(CHECKBOX);
    driver.handlerContext.changeListValue(component, []);
    expect(driver.extract._f).toEqual([{ '@value': null }]);
  });
});

describe('both copies of the instance stay in step', () => {
  /**
   * CEE keeps two trees — the extract copy it works against and the full copy
   * with `@context` and `@id` that the host page gets back. Every write goes to
   * both, and a write that reached only one would leave the host page saving
   * something the form is not showing.
   */
  it.each([
    ['literal', TEXT, (d: CeeDriver, c: unknown) => d.handlerContext.changeValue(c as never, 'v'), 'v'],
    [
      'link',
      LINK,
      (d: CeeDriver, c: unknown) => d.handlerContext.changeValue(c as never, 'https://x/1'),
      'https://x/1',
    ],
  ])('%s', (_label, fieldKind, write, expected) => {
    const { driver, component } = rig(fieldKind);
    write(driver, component);
    const extract = driver.extract._f;
    const full = driver.metadata._f;
    expect(extract['@value'] ?? extract['@id']).toBe(expected);
    expect(full['@value'] ?? full['@id'], 'the full copy did not receive the write').toBe(expected);
  });

  it('a controlled term reaches both copies', () => {
    const { driver, component } = rig(CONTROLLED);
    driver.handlerContext.changeControlledValue(component, 'https://x/1', 'One');
    expect(driver.emitted._f).toEqual({ '@id': 'https://x/1', 'rdfs:label': 'One' });
  });
});
