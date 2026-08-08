/**
 * What the handlers do when an instance node is not the shape the template says.
 *
 * These paths exist because an instance node is a union — a leaf, a list, or a
 * container — and the handlers walk it by component path without being able to
 * assume which. Until that union was written down the walks indexed blind, so a
 * scalar where a container belonged read as `undefined` and travelled on; the
 * guards that replaced those reads are what these tests exercise.
 *
 * A host page supplies the instance, so a mismatched shape is not hypothetical:
 * it is a wrong file, an older CEDAR export, or a hand-edited document. What CEE
 * owes in that case is to carry on editing the rest and say something, rather
 * than throw or write into the wrong place.
 *
 * The property names carry the generator's leading underscore, because that is
 * what appears in the instance.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');

describe('a value node replaced by a scalar', () => {
  it('does not throw when the edit lands on it', () => {
    const driver = new CeeDriver(buildTemplate({ name: 'malformed', children: [{ kind: TEXT, name: 'a' }] }));
    // The field's node should be `{'@value': null}`. A document that puts a bare
    // string there is what an older export or a hand edit produces.
    driver.dataContext.instanceFullData['_a'] = 'not a value node';

    expect(() => driver.setValue(['_a'], TEXT, 'typed')).not.toThrow();
  });

  it('leaves the rest of the instance editable', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'malformed_two',
        children: [
          { kind: TEXT, name: 'a' },
          { kind: TEXT, name: 'b' },
        ],
      }),
    );
    driver.dataContext.instanceFullData['_a'] = 'not a value node';

    driver.setValue(['_b'], TEXT, 'still works');
    expect(JSON.stringify(driver.metadata)).toContain('still works');
  });
});

describe('a container replaced by a scalar', () => {
  it('does not throw when walking through it to a child', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'malformed_element',
        elements: [{ name: 'el', children: [{ kind: TEXT, name: 'inner' }] }],
      }),
    );
    driver.dataContext.instanceFullData['_el'] = 'not an element';

    expect(() => driver.setValue(['_el', '_inner'], TEXT, 'x')).not.toThrow();
  });

  it('does not throw when the element is a list where a single was expected', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'malformed_element_list',
        elements: [{ name: 'el', children: [{ kind: TEXT, name: 'inner' }] }],
      }),
    );
    driver.dataContext.instanceFullData['_el'] = [];

    expect(() => driver.setValue(['_el', '_inner'], TEXT, 'x')).not.toThrow();
  });
});

describe('a list replaced by a scalar', () => {
  /**
   * A multi field's node is the array of its occurrences. Replacing it with a
   * scalar reaches `injectArrayValue`, which used to set `.length` and `.push` on
   * whatever it was handed.
   *
   * Asserting survival rather than a reported error on purpose: which of the two
   * guards on this path fires depends on whether the widget writes a list or a
   * single value, and pinning that would be a test of the route rather than of
   * the outcome.
   */
  it('does not throw', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'malformed_multi',
        children: [{ kind: TEXT, name: 'm', cardinality: 'multi', minItems: 1 }],
      }),
    );
    driver.dataContext.instanceFullData['_m'] = 'not a list';

    expect(() => driver.setValue(['_m'], TEXT, 'v')).not.toThrow();
  });
});

describe('a list replaced by a scalar, written as a list', () => {
  /**
   * `changeListValue` is the route a checkbox or multi-select takes: it hands the
   * whole array down at once, so the guard that matters is the one on the target
   * rather than on the value.
   */
  it('does not throw', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'malformed_list_write',
        children: [{ kind: TEXT, name: 'm', cardinality: 'multi', minItems: 1 }],
      }),
    );
    const component = driver.findOrThrow(['_m']);
    driver.dataContext.instanceFullData['_m'] = 'not a list';

    expect(() => driver.handlerContext.changeListValue(component, ['a', 'b'])).not.toThrow();
    expect(driver.messages.errors.join(' ')).toContain('list of occurrences');
  });
});

describe('copying an occurrence whose contents are malformed', () => {
  /**
   * Copying re-mints the `@id` on every element inside the new occurrence, which
   * means walking into whatever the occurrence holds. A scalar child is what
   * reaches the guard in `remintElementInstanceIds`.
   */
  it('does not throw', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'malformed_copy',
        elements: [{ name: 'el', cardinality: 'multi', minItems: 1, children: [{ kind: TEXT, name: 'inner' }] }],
      }),
    );
    const element = driver.findOrThrow(['_el']);
    const occurrences = driver.dataContext.instanceFullData['_el'];
    if (Array.isArray(occurrences) && occurrences.length > 0) {
      occurrences[0] = 'not an element';
    }

    expect(() => driver.handlerContext.copyMultiInstance(element as never)).not.toThrow();
  });
});

describe('adding an occurrence where the node is not a list', () => {
  /**
   * The "+" on a pager splices the new occurrence into the field's array. When the
   * instance has something else there, the splice has nothing to write into, and
   * saying so is the whole of the recovery.
   */
  it('reports rather than throwing', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'malformed_add',
        children: [{ kind: TEXT, name: 'm', cardinality: 'multi', minItems: 1 }],
      }),
    );
    const component = driver.findOrThrow(['_m']);
    driver.dataContext.instanceFullData['_m'] = 'not a list';

    expect(() => driver.handlerContext.addMultiInstance(component as never)).not.toThrow();
    expect(driver.messages.errors.join(' ').toLowerCase()).toContain('missing data in instance');
  });
});

describe('the quality report over a malformed instance', () => {
  it('still produces a report', () => {
    const driver = new CeeDriver(buildTemplate({ name: 'malformed_report', children: [{ kind: TEXT, name: 'a' }] }));
    driver.dataContext.instanceFullData['_a'] = 'not a value node';
    driver.dataContext.invalidateDerivedViews();

    expect(() => driver.handlerContext.buildQualityReport()).not.toThrow();
  });

  it('still produces a report when a container is a scalar', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'malformed_report_element',
        elements: [{ name: 'el', children: [{ kind: TEXT, name: 'inner' }] }],
      }),
    );
    driver.dataContext.instanceFullData['_el'] = 'not an element';
    driver.dataContext.invalidateDerivedViews();

    expect(() => driver.handlerContext.buildQualityReport()).not.toThrow();
  });
});
