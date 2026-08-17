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
 * named two functions no test had ever called: `deleteAttributeValue` and
 * `deleteAttributeValueRecursively`. The
 * round-trip suite writes one attribute and reads it back; everything after
 * that first write was unexercised.
 *
 * The reason to close it now rather than later: this is the code that the
 * instance-side move to the model library goes through. Attribute values are
 * the special case threaded through the `@#index[N]#@` cursor encoding, so
 * they are simultaneously the least tested and the most likely to break.
 */
import { describe, expect, it } from 'vitest';
import { DocumentKey } from '../src/document-keys';
import { CedarBuilders } from 'cedar-model-typescript-library';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { InstanceObject } from '@cee/models/instance-node.model';
import { arrayAt, objectAt } from '../src/nodes';
import { InstanceDataAttributeValueFieldName } from 'cedar-model-typescript-library';
import { literalOf, heldValue, attributeValue, instanceWith } from '../src/values';

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
/** The names an attribute-value field is holding, in page order. */
const attributeNames = (slots: unknown): (string | null)[] =>
  (Array.isArray(slots) ? slots : []).map((slot) =>
    slot instanceof InstanceDataAttributeValueFieldName ? slot.name : null,
  );

/** What the attribute named `key` holds, wherever the field keeps it. */
const valueOf = (container: InstanceObject, key: string) => attributeValue(container, '_av', key);

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

/**
 * A loaded instance that carries no slot for the field.
 *
 * Every test above starts from a template alone, so CEE builds the tree and every
 * declared child has a slot in it before anything is added. A loaded instance is
 * under no such obligation: the template declares the property, the document need
 * not carry it, and an attribute-value field naming no attribute is what CEDAR
 * writes when nobody has filled one in. There was nothing at that path to add an
 * occurrence to, so the add was refused and the field could not be used at all.
 */
describe('an attribute-value field the instance says nothing about', () => {
  const TEMPLATE_IRI = 'https://repo.metadatacenter.org/templates/avflat';
  const INSTANCE_IRI = 'https://example.org/i/1';

  /** The instance a host hands over, with `_av` set to whatever a case needs. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loaded = (slot?: unknown): any => {
    const instance = instanceWith(TEMPLATE_IRI, {}, INSTANCE_IRI);
    if (slot !== undefined) {
      (instance as Record<string, unknown>)._av = slot;
    }
    return instance;
  };

  it.each([
    ['the key is absent', undefined],
    // What a sparse instance used to be inflated with before the model library
    // learned that this field's empty slot is a list.
    ['the key holds an empty node', {}],
  ])('adds an attribute when %s', (_label, slot) => {
    const driver = new CeeDriver(flat(), { instance: loaded(slot) });
    const component = driver.findOrThrow(['_av']);

    addAttribute(driver, component, 'colour', 'blue');
    driver.expectNoErrors('adding to a field with no slot');

    expect(attributeNames(driver.extract.values._av)).toEqual(['colour']);
    expect(valueOf(driver.extract, 'colour')).toBe('blue');
  });

  /**
   * The list is created for a slot that holds nothing. A slot holding something
   * else is a disagreement between the template and the document, and replacing it
   * on the strength of a click would discard whatever is there.
   */
  it('refuses, and says so, when the slot holds a value instead', () => {
    const driver = new CeeDriver(flat(), { instance: loaded({ '@value': 'not a list' }) });
    const component = driver.findOrThrow(['_av']);

    driver.handlerContext.addMultiInstance(component);

    expect(driver.messages.errors.join('\n')).toContain('missing data in instance');
  });
});

describe('adding an attribute value', () => {
  it('writes the value onto the parent, under the name the user chose', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    driver.expectNoErrors('adding an attribute');

    expect(valueOf(driver.extract, 'colour')).toBe('blue');
    // The field's own slot holds the *name*, which is what makes this field
    // type unlike every other one.
    expect(heldValue(driver.extract.values._av)).toContain('colour');
  });

  /**
   * The attribute is a new property of the instance and CEE does not name it.
   *
   * It minted `https://schema.metadatacenter.org/properties/<guid>` here, which
   * is an identity nothing assigned. The model library states the shape a draft
   * takes — the value sits at the instance root with no `@context` term, and the
   * server fills the term on upload — and dropped `PropertyIri.forId` so the
   * minting had nowhere to come from.
   */
  it('names the new property nowhere, leaving the term to the server', () => {
    const driver = new CeeDriver(flat());
    addAttribute(driver, driver.findOrThrow(['_av']), 'colour', 'blue');

    const context = driver.metadata[DocumentKey.atContext];
    expect(context.colour, 'an invented @context entry for the attribute').toBeUndefined();
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
    expect(driver.extract.values.colour, 'the old attribute name survived the rename').toBeUndefined();
    expect(heldValue(driver.extract.values._av)).toEqual(['hue']);
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
    const original = driver.metadata[DocumentKey.atContext].colour;

    driver.handlerContext.changeAttributeValue(component, 'hue', 'blue');
    const context = driver.metadata[DocumentKey.atContext];

    expect(context.hue).toBe(original);
    expect(context.colour).toBeUndefined();
  });
});

describe('copying an attribute', () => {
  it('copies its name and value without changing the source', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'a1', 'v1');

    driver.handlerContext.copyMultiInstance(component);

    expect(heldValue(driver.extract.values._av)).toEqual(['a1', 'a1 copy']);
    expect(valueOf(driver.extract, 'a1')).toBe('v1');
    expect(valueOf(driver.extract, 'a1 copy')).toBe('v1');
    expect(driver.emitted._av).toEqual(['a1', 'a1 copy']);
    expect(driver.emitted.a1[DocumentKey.atValue]).toBe('v1');
    expect(driver.emitted['a1 copy'][DocumentKey.atValue]).toBe('v1');
    // Neither carries a term, so neither can carry the other's.
    expect(driver.emitted[DocumentKey.atContext]['a1 copy']).toBeUndefined();
    expect(driver.emitted[DocumentKey.atContext].a1).toBeUndefined();

    driver.handlerContext.setCurrentIndex(component, 0);
    expect(valueOf(driver.extract, 'a1')).toBe('v1');
  });

  it('numbers the derived name when that name is already occupied', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'a1', 'v1');
    addAttribute(driver, component, 'a1 copy', 'existing');
    driver.handlerContext.setCurrentIndex(component, 0);

    driver.handlerContext.copyMultiInstance(component);

    expect(heldValue(driver.extract.values._av)).toEqual(['a1', 'a1 copy 2', 'a1 copy']);
    expect(valueOf(driver.extract, 'a1 copy 2')).toBe('v1');
    expect(valueOf(driver.extract, 'a1 copy')).toBe('existing');
  });
});

describe('names the user did not supply', () => {
  /**
   * REGRESSION SURFACE: `getDefaultAttributeName` had never been called by any
   * test. The attribute-value widget calls `changeAttributeValue` on every
   * keystroke in either box, so a blank name is not an edge case — it is the
   * state of every attribute the moment it is created.
   */
  it('keeps a new row unnamed until the user supplies a name', () => {
    const driver = new CeeDriver(flat());
    addAttribute(driver, driver.findOrThrow(['_av']), null, 'blue');
    driver.expectNoErrors('adding an unnamed attribute');

    expect(heldValue(driver.extract.values._av)).toEqual(['']);
    expect(driver.extract.hasValue('Attribute Value Field1'), 'a name was manufactured').toBe(false);
    // The row stays in CEE's editing model, where the user can finish it, but it
    // is not an attribute until it has a name and must not leave CEE as one.
    expect(driver.metadata._av).toEqual([]);
    expect(driver.emitted._av).toEqual([]);
  });

  it('does not let a second attribute overwrite the first by reusing its name', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    driver.handlerContext.addMultiInstance(component);
    const error = driver.handlerContext.changeAttributeValue(component, 'colour', 'red');

    // The first value stands; the duplicate row remains unnamed until the user
    // chooses a name that can safely become a JSON property.
    expect(valueOf(driver.extract, 'colour')).toBe('blue');
    expect(heldValue(driver.extract.values._av)).toEqual(['colour', null]);
    expect(error).toContain('already used');
  });

  /**
   * The handler returns the explanation to the widget instead of emitting a
   * global notification. The input can therefore keep the rejected text in
   * view with a local error while the instance stays valid.
   */
  it('returns a local explanation without emitting a global error', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    driver.handlerContext.addMultiInstance(component);
    const error = driver.handlerContext.changeAttributeValue(component, 'colour', 'red');

    expect(error).toBe('Attribute name "colour" is already used in this instance. Choose a unique name.');
    driver.expectNoErrors('the duplicate is explained next to its input');
  });

  it('rejects a name already occupied by an ordinary field', () => {
    const template = buildTemplate({
      name: 'av_and_text',
      children: [
        { kind: TEXT, name: 'text' },
        { kind: ATTR, name: 'av' },
      ],
    });
    const driver = new CeeDriver(template);
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, null, 'would overwrite text');

    const error = driver.handlerContext.changeAttributeValue(component, '_text', 'would overwrite text');

    expect(error).toContain('already used');
    expect(heldValue(driver.extract.values._av)).toEqual(['']);
  });

  it('reserves a declared field name even when a sparse instance omits that field', () => {
    const template = buildTemplate({
      name: 'av_and_sparse_text',
      children: [
        { kind: TEXT, name: 'text' },
        { kind: ATTR, name: 'av' },
      ],
    });
    const sparse = instanceWith('https://repo.metadatacenter.org/templates/av-and-sparse-text', {
      _av: [],
    });
    const driver = new CeeDriver(template, { instance: sparse });
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, null, 'must not claim a declared property');

    const error = driver.handlerContext.changeAttributeValue(component, '_text', 'must not claim a declared property');

    expect(error).toContain('already used');
    expect(driver.extract.hasValue('_text')).toBe(false);
    expect(heldValue(driver.extract.values._av)).toEqual(['']);
  });

  it.each(['@context', '@anything', 'schema:name', '_annotations'])(
    'rejects the reserved instance name %s',
    (reservedName) => {
      const driver = new CeeDriver(flat());
      const component = driver.findOrThrow(['_av']);
      addAttribute(driver, component, null, 'metadata must survive');

      const error = driver.handlerContext.changeAttributeValue(component, reservedName, 'metadata must survive');

      expect(error).toContain('reserved');
      expect(heldValue(driver.extract.values._av)).toEqual(['']);
      expect(driver.extract.hasValue(reservedName)).toBe(false);
    },
  );

  it('rejects a name already used by another attribute-value field', () => {
    const template = buildTemplate({
      name: 'two_av_fields',
      children: [
        { kind: ATTR, name: 'first' },
        { kind: ATTR, name: 'second' },
      ],
    });
    const driver = new CeeDriver(template);
    addAttribute(driver, driver.findOrThrow(['_first']), 'colour', 'blue');
    const second = driver.findOrThrow(['_second']);
    addAttribute(driver, second, null, 'red');

    const error = driver.handlerContext.changeAttributeValue(second, 'colour', 'red');

    expect(error).toContain('already used');
    expect(valueOf(driver.extract, 'colour')).toBe('blue');
    expect(heldValue(driver.extract.values._second)).toEqual(['']);
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

  it('writes a pending value when the user subsequently supplies its name', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, null, 'blue');
    driver.handlerContext.changeAttributeValue(component, 'colour', 'blue');
    driver.expectNoErrors('naming a pending attribute');

    expect(heldValue(driver.extract.values._av)).toEqual(['colour']);
    expect(valueOf(driver.extract, 'colour')).toBe('blue');
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

    expect(driver.extract.values.colour).toBeUndefined();
    expect(driver.emitted[DocumentKey.atContext].colour, 'the @context entry outlived the attribute').toBeUndefined();
  });

  it('leaves the other attributes alone', () => {
    const driver = new CeeDriver(flat());
    const component = driver.findOrThrow(['_av']);
    addAttribute(driver, component, 'colour', 'blue');
    addAttribute(driver, component, 'size', 'large');

    driver.handlerContext.deleteAttributeValue(component, 'colour');
    driver.expectNoErrors('deleting one of two attributes');

    expect(driver.extract.values.colour).toBeUndefined();
    expect(valueOf(driver.extract, 'size')).toBe('large');
    // The surviving attribute keeps its value; neither ever carried a term.
    expect(driver.emitted[DocumentKey.atContext].size).toBeUndefined();
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

    expect(valueOf(objectAt(driver.extract, '_el'), 'colour')).toBe('blue');
    expect(driver.extract.values.colour, 'the attribute leaked onto the template').toBeUndefined();
    expect(driver.emitted._el[DocumentKey.atContext].colour).toBeUndefined();
  });

  it('rejects a collision with an ordinary child in the enclosing element', () => {
    const template = buildTemplate({
      name: 'av_nested_collision',
      elements: [
        {
          name: 'el',
          children: [
            { kind: TEXT, name: 'text' },
            { kind: ATTR, name: 'av' },
          ],
        },
      ],
    });
    const driver = new CeeDriver(template);
    const component = driver.findOrThrow(['_el', '_av']);
    addAttribute(driver, component, null, 'must not replace the nested text field');

    const error = driver.handlerContext.changeAttributeValue(
      component,
      '_text',
      'must not replace the nested text field',
    );

    expect(error).toContain('already used');
    expect(heldValue(objectAt(driver.extract, '_el').values._av)).toEqual(['']);
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

    expect(objectAt(driver.extract, '_el').values.colour).toBeUndefined();
    expect(driver.emitted._el[DocumentKey.atContext].colour).toBeUndefined();
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

    const occurrences = arrayAt(driver.extract, '_el');
    expect(Array.isArray(occurrences), 'multi element did not build as an array').toBe(true);
    expect(occurrences).toHaveLength(2);
    expect(valueOf(objectAt(occurrences[0]), 'first')).toBe('one');
    expect(
      objectAt(occurrences[0]).values.second,
      'the second attribute landed in the first occurrence',
    ).toBeUndefined();
    expect(valueOf(objectAt(occurrences[1]), 'second')).toBe('two');
    expect(
      objectAt(occurrences[1]).values.first,
      'the first attribute leaked into the second occurrence',
    ).toBeUndefined();
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

    const occurrences = arrayAt(driver.extract, '_el');
    expect(valueOf(objectAt(occurrences[0]), 'first'), 'deleting from one occurrence cleared another').toBe('one');
    expect(objectAt(occurrences[1]).values.second).toBeUndefined();
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
