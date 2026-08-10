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
 * hold an empty literal where CEE's own skeleton would leave the slot unfilled.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, ControlledTermOntologyBuilder, Iri } from 'cedar-model-typescript-library';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import type { InstanceNode } from '@cee/models/instance-node.model';
import { instanceWith, iriOf, isLiteral, linkValue, literalOf, literalValue, termOf, termValue } from '../src/values';
import type { InstanceDataAtomType } from 'cedar-model-typescript-library';

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
const rig = (fieldKind: FieldKind, startingSlot?: InstanceDataAtomType) => {
  const template = buildTemplate({ name: `vw_${fieldKind.key}`, children: [{ kind: fieldKind, name: 'f' }] });
  const driver =
    startingSlot === undefined
      ? new CeeDriver(template)
      : new CeeDriver(template, {
          instance: instanceWith(TEMPLATE_IRI, { _f: startingSlot }, 'https://example.org/i/1'),
        });
  return { driver, component: driver.findOrThrow(['_f']) };
};

describe('writing a value for the first time', () => {
  it('a literal lands as @value', () => {
    const { driver, component } = rig(TEXT);
    driver.handlerContext.changeValue(component, 'typed');
    expect(literalOf(driver.extract._f)).toBe('typed');
  });

  it('a link lands as @id, not @value', () => {
    const { driver, component } = rig(LINK);
    driver.handlerContext.changeValue(component, 'https://example.org/thing');
    expect(iriOf(driver.extract._f)).toBe('https://example.org/thing');
    expect(isLiteral(driver.extract._f), 'a link was written as a literal').toBe(false);
  });

  it('an external authority value lands as @id', () => {
    const { driver, component } = rig(ORCID);
    driver.handlerContext.changeValue(component, 'https://orcid.org/0000-0002-1825-0097');
    expect(iriOf(driver.extract._f)).toBe('https://orcid.org/0000-0002-1825-0097');
    expect(isLiteral(driver.extract._f)).toBe(false);
  });

  it('a controlled term lands as @id and label', () => {
    const { driver, component } = rig(CONTROLLED);
    driver.handlerContext.changeControlledValue(component, 'https://x/1', 'One');
    expect(termOf(driver.extract._f)).toEqual({ iri: 'https://x/1', label: 'One' });
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
    const { driver, component } = rig(LINK, literalValue('left over'));
    driver.handlerContext.changeValue(component, 'https://example.org/thing');

    expect(iriOf(driver.extract._f)).toBe('https://example.org/thing');
    expect(isLiteral(driver.extract._f), 'the stale literal survived').toBe(false);
  });

  it('a controlled term replaces a literal rather than joining it', () => {
    const { driver, component } = rig(CONTROLLED, literalValue('left over'));
    driver.handlerContext.changeControlledValue(component, 'https://x/1', 'One');

    expect(iriOf(driver.extract._f)).toBe('https://x/1');
    expect(isLiteral(driver.extract._f), 'the stale literal survived').toBe(false);
  });

  it('a new IRI replaces the previous one', () => {
    const { driver, component } = rig(CONTROLLED, termValue('https://x/1', 'One'));
    driver.handlerContext.changeControlledValue(component, 'https://x/2', 'Two');
    expect(termOf(driver.extract._f)).toEqual({ iri: 'https://x/2', label: 'Two' });
  });

  it('a new literal replaces the previous one', () => {
    const { driver, component } = rig(TEXT, literalValue('first'));
    driver.handlerContext.changeValue(component, 'second');
    expect(literalOf(driver.extract._f)).toBe('second');
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
    const { driver, component } = rig(TEXT, termValue('https://x/1', 'One'));
    driver.handlerContext.changeValue(component, 'typed');

    expect(literalOf(driver.extract._f)).toBe('typed');
  });
});

describe('clearing a value', () => {
  it('clearing a literal leaves the slot present and empty', () => {
    const { driver, component } = rig(TEXT, literalValue('something'));
    driver.handlerContext.changeValue(component, null);
    expect(literalOf(driver.extract._f)).toBeNull();
  });

  it('clearing a controlled term empties it without removing the slot', () => {
    const { driver, component } = rig(CONTROLLED, termValue('https://x/1', 'One'));
    driver.handlerContext.changeControlledValue(component, null, null);
    // `undefined` values do not survive serialisation, so the saved slot is `{}`.
    expect(JSON.parse(JSON.stringify(driver.extract._f))).toEqual({});
  });

  it('clearing a link removes the IRI', () => {
    const { driver, component } = rig(LINK, linkValue('https://example.org/thing'));
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
    expect((driver.extract._f as unknown[]).map(literalOf)).toEqual(['A', 'B']);
  });

  it('replaces the whole list rather than appending', () => {
    const { driver, component } = rig(CHECKBOX);
    driver.handlerContext.changeListValue(component, ['A', 'B']);
    driver.handlerContext.changeListValue(component, ['B']);
    expect((driver.extract._f as unknown[]).map(literalOf)).toEqual(['B']);
  });

  it('an empty selection writes one empty slot rather than none', () => {
    const { driver, component } = rig(CHECKBOX);
    driver.handlerContext.changeListValue(component, []);
    expect((driver.extract._f as unknown[]).map(literalOf)).toEqual([null]);
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
    expect(literalOf(extract) ?? iriOf(extract)).toBe(expected);
    expect(literalOf(full) ?? iriOf(full), 'the full copy did not receive the write').toBe(expected);
  });

  it('a controlled term reaches both copies', () => {
    const { driver, component } = rig(CONTROLLED);
    driver.handlerContext.changeControlledValue(component, 'https://x/1', 'One');
    expect(termOf(driver.emitted._f)).toEqual({ iri: 'https://x/1', label: 'One' });
  });
});
