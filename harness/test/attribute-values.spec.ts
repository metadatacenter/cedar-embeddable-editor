/**
 * Attribute-value fields: the editing path, not just the reading of one.
 *
 * An attribute-value field is the odd one out in the CEDAR model. Every other
 * field owns a slot in the instance and puts a value in it; this one lets the
 * user invent the key as well, so a single component writes to three places at
 * once — its own array holds the attribute *names*, the value lands as a
 * property of the *parent* object, and `@context` gains an IRI for the new
 * property. Renaming has to move all three together, and deleting has to
 * unpick them.
 *
 * None of that had a test. Coverage over the domain layer put
 * `data-object-data-value.handler.ts` at 78% — the lowest of any handler — and
 * named three functions no test had ever called: `deleteAttributeValue`,
 * `deleteAttributeValueRecursively`, and `getDefaultAttributeName`, which is
 * what runs whenever the user leaves the name blank or reuses one. The
 * round-trip suite writes one attribute and reads it back; everything after
 * that first write was unexercised.
 *
 * The reason to close it now rather than later: this is the code that the
 * instance-side move to the model library goes through. Attribute values are
 * the special case threaded through the `@#index[N]#@` cursor encoding, so
 * they are simultaneously the least tested and the most likely to break.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { literalOf } from '../src/values';

const ATTR: FieldKind = {
  key: 'attr',
  inputType: 'attribute-value',
  make: () => CedarBuilders.attributeValueFieldBuilder(),
  isStatic: false,
  write: 'attribute',
  sample: 'attr value',
};

const TEXT: FieldKind = {
  key: 'text',
  inputType: 'textfield',
  make: () => CedarBuilders.textFieldBuilder(),
  isStatic: false,
  write: 'value',
  sample: 'x',
};

/** A template with one attribute-value field directly on it. */
const flat = () => buildTemplate({ name: 'av_flat', children: [{ kind: ATTR, name: 'av' }] });

/** The `@value` behind an attribute, or undefined when the key is absent. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const valueOf = (node: any, key: string) => literalOf(node?.[key]);

/**
 * Add an attribute the way the UI does: make a slot, then name it.
 *
 * An attribute-value field starts at zero occurrences — `minItems` is 0 for
 * this type whatever the template declares — so the name/value boxes do not
 * exist until the pager's "+" has produced a row. Writing straight into a
 * field with no slot puts the value on the parent object but leaves the name
 * off the field's own array, which is a state no user can reach.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addAttribute = (driver: CeeDriver, component: any, name: string | null, value: string | null): void => {
  driver.handlerContext.addMultiInstance(component);
  driver.handlerContext.changeAttributeValue(component, name, value);
};

describe('adding an attribute value', () => {
  it('writes the value onto the parent, under the name the user chose', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    driver.expectNoErrors('adding an attribute');

    expect(valueOf(driver.extract, 'colour')).toBe('blue');
    // The field's own slot holds the *name*, which is what makes this field
    // type unlike every other one.
    expect(driver.extract._av).toContain('colour');
  });

  /**
   * The attribute is a new property of the instance, so it needs a term IRI
   * like any other. CEE mints one; only `instanceFullData` carries `@context`,
   * since the extract form drops it.
   */
  it('mints an @context entry for the new property', () => {
    const driver = new CeeDriver(flat());
    addAttribute(driver, driver.findOrThrow(['_av']), 'colour', 'blue');

    const context = driver.metadata['@context'];
    expect(context.colour, 'no @context entry minted for the attribute').toBeTruthy();
    // The field's own placeholder entry goes away — the property is now the
    // attribute, not the field.
    expect(context._av).toBeUndefined();
  });

  it('keeps several attributes side by side', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    addAttribute(driver, component, 'size', 'large');
    driver.expectNoErrors('adding a second attribute');

    expect(valueOf(driver.extract, 'colour')).toBe('blue');
    expect(valueOf(driver.extract, 'size')).toBe('large');
  });
});

describe('renaming an attribute', () => {
  it('moves the value and drops the old key', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    driver.handlerContext.changeAttributeValue(component, 'hue', 'blue');
    driver.expectNoErrors('renaming an attribute');

    expect(valueOf(driver.extract, 'hue')).toBe('blue');
    expect(driver.extract.colour, 'the old attribute name survived the rename').toBeUndefined();
    expect(driver.extract._av).toEqual(['hue']);
  });

  /**
   * The IRI follows the attribute rather than being reminted. Worth pinning:
   * the property is conceptually the same one under a new label, and a fresh
   * IRI on every keystroke would churn the instance's `@context` and break any
   * consumer that had resolved the term.
   */
  it('carries the term IRI across to the new name', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    const original = driver.metadata['@context'].colour;

    driver.handlerContext.changeAttributeValue(component, 'hue', 'blue');
    const context = driver.metadata['@context'];

    expect(context.hue).toBe(original);
    expect(context.colour).toBeUndefined();
  });
});

describe('names the user did not supply', () => {
  /**
   * REGRESSION SURFACE: `getDefaultAttributeName` had never been called by any
   * test. The attribute-value widget calls `changeAttributeValue` on every
   * keystroke in either box, so a blank name is not an edge case — it is the
   * state of every attribute the moment it is created.
   */
  it('generates a name when none is given', () => {
    const driver = new CeeDriver(flat());
    addAttribute(driver, driver.findOrThrow(['_av']), null, 'blue');
    driver.expectNoErrors('adding an unnamed attribute');

    const names: string[] = driver.extract._av;
    expect(names).toHaveLength(1);
    expect(names[0], 'no name was generated for the blank attribute').toBeTruthy();
    expect(valueOf(driver.extract, names[0])).toBe('blue');
  });

  it('does not let a second attribute overwrite the first by reusing its name', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    addAttribute(driver, component, 'colour', 'red');

    // The first value stands; the duplicate gets a generated name of its own.
    expect(valueOf(driver.extract, 'colour')).toBe('blue');
    const names: string[] = driver.extract._av;
    expect(names).toHaveLength(2);
    expect(names[1]).not.toBe('colour');
    expect(valueOf(driver.extract, names[1])).toBe('red');
  });

  /**
   * BEHAVIOUR CHANGE: the rename above used to happen in silence. A name the
   * user typed was discarded and the box changed under them with no
   * explanation — data loss, small but real.
   */
  it('says so when it discards a name the user typed', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    addAttribute(driver, component, 'colour', 'red');

    expect(driver.messages.errors.join('\n')).toContain('colour');
    expect(driver.messages.errors.join('\n')).toContain('already used');
  });

  /**
   * The other half, and the reason this is not simply "report every
   * substitution": the widget calls through on every keystroke in either box,
   * so a blank name is the state of every attribute the moment it is created.
   * Reporting that would put an error under the field before the user had
   * typed a character — the same mistake as pointing a value validator at a
   * search box.
   */
  it('stays quiet about a name the user has not typed yet', () => {
    const driver = new CeeDriver(flat());
    addAttribute(driver, driver.findOrThrow(['_av']), null, 'blue');
    driver.expectNoErrors('a blank attribute name is not a complaint');
  });

  it('stays quiet about an empty-string name too', () => {
    const driver = new CeeDriver(flat());
    addAttribute(driver, driver.findOrThrow(['_av']), '', 'blue');
    driver.expectNoErrors('an empty attribute name is not a complaint');
  });

  it('keeps generating distinct names when the generated one also collides', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, null, 'one');
    addAttribute(driver, component, null, 'two');
    addAttribute(driver, component, null, 'three');
    driver.expectNoErrors('adding three unnamed attributes');

    const names: string[] = driver.extract._av;
    expect(new Set(names).size, `generated names collided: ${names.join(', ')}`).toBe(3);
    expect(names.map((n) => valueOf(driver.extract, n))).toEqual(['one', 'two', 'three']);
  });
});

describe('deleting an attribute', () => {
  /**
   * REGRESSION SURFACE: `deleteAttributeValue` and its recursive half had
   * never been called by any test, and they are what the widget's delete
   * button runs.
   */
  it('removes the value and its @context entry', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    driver.handlerContext.deleteAttributeValue(component, 'colour');
    driver.expectNoErrors('deleting an attribute');

    expect(driver.extract.colour).toBeUndefined();
    expect(driver.emitted['@context'].colour, 'the @context entry outlived the attribute').toBeUndefined();
  });

  it('leaves the other attributes alone', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    addAttribute(driver, component, 'size', 'large');

    driver.handlerContext.deleteAttributeValue(component, 'colour');
    driver.expectNoErrors('deleting one of two attributes');

    expect(driver.extract.colour).toBeUndefined();
    expect(valueOf(driver.extract, 'size')).toBe('large');
    expect(driver.emitted['@context'].size).toBeTruthy();
  });

  it('is a no-op when no name is given', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    driver.handlerContext.deleteAttributeValue(component, null);
    driver.expectNoErrors('deleting with no name');

    expect(valueOf(driver.extract, 'colour')).toBe('blue');
  });
});

describe('attribute values inside elements', () => {
  /**
   * The recursive branch: the attribute lands on the enclosing element's
   * object, not the template's, so both the write and the delete have to walk
   * down before they act.
   */
  it('writes to the enclosing element, not the template', () => {
    const template = buildTemplate({
      name: 'av_nested',
      elements: [{ name: 'el', children: [{ kind: ATTR, name: 'av' }] }],
    });
    const driver = new CeeDriver(template);
    addAttribute(driver, driver.findOrThrow(['_el', '_av']), 'colour', 'blue');
    driver.expectNoErrors('adding an attribute inside an element');

    expect(valueOf(driver.extract._el, 'colour')).toBe('blue');
    expect(driver.extract.colour, 'the attribute leaked onto the template').toBeUndefined();
    expect(driver.emitted._el['@context'].colour).toBeTruthy();
  });

  it('deletes from the enclosing element', () => {
    const template = buildTemplate({
      name: 'av_nested_del',
      elements: [{ name: 'el', children: [{ kind: ATTR, name: 'av' }] }],
    });
    const driver = new CeeDriver(template);
    const component = driver.findOrThrow(['_el', '_av']);
    addAttribute(driver, component, 'colour', 'blue');
    driver.handlerContext.deleteAttributeValue(component, 'colour');
    driver.expectNoErrors('deleting an attribute inside an element');

    expect(driver.extract._el.colour).toBeUndefined();
    expect(driver.emitted._el['@context'].colour).toBeUndefined();
  });

  /**
   * The case the instance-side refactor has to survive: the attribute sits
   * inside a multi element, so resolving where it goes means reading that
   * element's cursor. Write into the second occurrence and the first must be
   * untouched — the `@#index[N]#@` encoding is exactly what decides that.
   */
  it('respects the cursor of a multi element above it', () => {
    const template = buildTemplate({
      name: 'av_multi_el',
      elements: [
        {
          name: 'el',
          cardinality: 'multi',
          minItems: 1,
          maxItems: 5,
          children: [
            { kind: ATTR, name: 'av' },
            { kind: TEXT, name: 'txt' },
          ],
        },
      ],
    });
    const driver = new CeeDriver(template);
    const element = driver.findOrThrow(['_el']);
    const component = driver.findOrThrow(['_el', '_av']);

    addAttribute(driver, component, 'first', 'one');
    driver.handlerContext.addMultiInstance(element);
    addAttribute(driver, component, 'second', 'two');
    driver.expectNoErrors('adding attributes across two element occurrences');

    const occurrences = driver.extract._el;
    expect(Array.isArray(occurrences), 'multi element did not build as an array').toBe(true);
    expect(occurrences).toHaveLength(2);
    expect(valueOf(occurrences[0], 'first')).toBe('one');
    expect(occurrences[0].second, 'the second attribute landed in the first occurrence').toBeUndefined();
    expect(valueOf(occurrences[1], 'second')).toBe('two');
    expect(occurrences[1].first, 'the first attribute leaked into the second occurrence').toBeUndefined();
  });

  it('deletes from the occurrence the cursor is on', () => {
    const template = buildTemplate({
      name: 'av_multi_el_del',
      elements: [
        {
          name: 'el',
          cardinality: 'multi',
          minItems: 1,
          maxItems: 5,
          children: [{ kind: ATTR, name: 'av' }],
        },
      ],
    });
    const driver = new CeeDriver(template);
    const element = driver.findOrThrow(['_el']);
    const component = driver.findOrThrow(['_el', '_av']);

    addAttribute(driver, component, 'first', 'one');
    driver.handlerContext.addMultiInstance(element);
    addAttribute(driver, component, 'second', 'two');
    driver.handlerContext.deleteAttributeValue(component, 'second');
    driver.expectNoErrors('deleting from the second occurrence');

    const occurrences = driver.extract._el;
    expect(valueOf(occurrences[0], 'first'), 'deleting from one occurrence cleared another').toBe('one');
    expect(occurrences[1].second).toBeUndefined();
  });
});

describe('whether the pager has anything to page through', () => {
  /**
   * `hasMultiInstances` is what the multi-pager's template asks before showing
   * "no values yet". Trivial, live, and it had no test — it is only reachable
   * through an Angular template, which the harness deliberately does not load.
   */
  it('is false before an attribute is added and true after', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    const service = driver.handlerContext.multiInstanceObjectService;

    expect(service.hasMultiInstances(component)).toBe(false);
    addAttribute(driver, component, 'colour', 'blue');
    expect(service.hasMultiInstances(component)).toBe(true);
  });
});

describe('attribute values and the quality report', () => {
  /**
   * A required attribute-value field is a strange thing to declare — the field
   * cannot know what attribute the user is supposed to name — but the model
   * permits it, so the report has to have an answer rather than throwing.
   */
  it('reports on a template carrying attribute values', () => {
    const driver = new CeeDriver(flat());
    addAttribute(driver, driver.findOrThrow(['_av']), 'colour', 'blue');
    driver.handlerContext.buildQualityReport();

    expect(typeof driver.qualityReport.isValid).toBe('boolean');
    driver.expectNoErrors('building the quality report');
  });
});
