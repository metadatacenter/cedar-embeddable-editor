/**
 * The identity an element occurrence has, and where it comes from.
 *
 * Not from CEE. It minted one — `https://repo.metadatacenter.org/template-element-instances/<guid>`
 * — into every occurrence it built, on the stated grounds that CEDAR requires an
 * `@id` there. A template's element sub-schema does name `@id` in its `required`
 * list, but the validator does not enforce a value for it: an occurrence
 * validates with the key null and with the key absent, and rejects only a string
 * that is not a URI. So the requirement CEE was meeting did not exist, and what
 * it minted was an identity the artifact does not have — different on every build
 * of the same form, and naming a repository that has never heard of it.
 *
 * An identity now only ever arrives from outside, in a loaded instance. CEE's job
 * is to leave that one alone, and to put it on nothing else.
 *
 * This replaces `tree-consistency.spec.ts`, which was what remained of a file
 * about CEE's two instance trees once there was one tree, and had nothing left in
 * it but the minting.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { FieldKind } from '../src/axes';
import { identityOf } from '../src/values';

const TEXT = {
  key: 'text',
  inputType: 'textfield',
  make: () => CedarBuilders.textFieldBuilder(),
  isStatic: false,
  write: 'value',
  sample: 'a value',
} as unknown as FieldKind;

const withOccurrences = () =>
  buildTemplate({
    name: 'oi_multi',
    elements: [{ name: 'el', cardinality: 'multi', minItems: 2, maxItems: 5, children: [{ kind: TEXT, name: 'f' }] }],
  });

describe('a built instance', () => {
  it('invents no identity for an occurrence', () => {
    const occurrences = new CeeDriver(withOccurrences()).metadata._el;

    expect(occurrences).toHaveLength(2);
    expect(occurrences.map(identityOf)).toEqual([null, null]);
  });

  /**
   * Two builds of the same empty form are the same document.
   *
   * The minted GUIDs made every rendering differ from the last, which is why the
   * harness carried a `normalize` that rewrote them to `<minted>` before any
   * comparison, and why a snapshot of a freshly built instance recorded a value
   * that meant nothing.
   */
  it('is identical to another build of the same template', () => {
    const template = withOccurrences();

    expect(new CeeDriver(template).metadata).toEqual(new CeeDriver(template).metadata);
  });
});

describe('an identity that arrived with the instance', () => {
  /**
   * The one case where an occurrence has an identity worth keeping: a repository
   * assigned it, and it names something real.
   */
  it('survives an edit elsewhere in the form', () => {
    const driver = new CeeDriver(withOccurrences());
    const assigned = 'https://repo.metadatacenter.org/template-element-instances/loaded';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    driver.dataContext.mutate((instance: any) => {
      instance.values._el[0].id = assigned;
    });

    driver.setValue(['_el', '_f'], TEXT, 'edited');

    expect(identityOf(driver.metadata._el[0])).toBe(assigned);
    expect(identityOf(driver.metadata._el[1])).toBeNull();
  });

  /**
   * CEDAR itself stored this spelling before occurrence identity became
   * server-owned. Refusing it here strands a production instance before the
   * artifact server's inherited-defect repair can see it. CEE's compatibility
   * reader opens it and its writer changes only the invalid placeholder to the
   * canonical request for server assignment.
   */
  it('opens a legacy blank occurrence id and emits null for server assignment', () => {
    const template = withOccurrences();
    const legacy = new CeeDriver(template).metadata;
    legacy._el[0]['@id'] = '';

    const loaded = new CeeDriver(template, { instance: legacy });

    expect(identityOf(loaded.metadata._el[0])).toBeNull();
    expect(identityOf(loaded.metadata._el[1])).toBeNull();
    expect(identityOf(legacy._el[0])).toBe('');
    loaded.expectNoErrors('legacy occurrence load');
  });
});
