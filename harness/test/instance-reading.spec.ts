/**
 * Reading an existing instance back in.
 *
 * When a host page hands CEE an `instanceObject`, the template alone no longer
 * decides the shape of the form: the instance does. A multi element the
 * template says starts at one may arrive holding four, and the pager has to
 * come back showing four. `MultiInstanceObjectHandler.updateFromInstanceExtractData`
 * is what works that out, by walking the instance and reconciling what it finds
 * against the skeleton `buildRecursively` produced from the template.
 *
 * It is the least direct code in the domain layer. Paths are encoded as
 * strings with `@#index[N]#@` segments spliced in for each occurrence, then
 * re-parsed with a regex to navigate the info tree, growing that tree in place
 * wherever the instance turns out to be deeper or wider than the template's
 * minimum. Coverage found the growth branches unexercised: the suite only ever
 * loaded instances that matched their template's `minItems` exactly, so the
 * reconciliation never had to reconcile anything.
 *
 * That is the half of the instance side the model library is meant to take
 * over, so it needs to be pinned before, not after.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, ControlledTermOntologyBuilder, Iri } from 'cedar-model-typescript-library';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { infoOf, objectAt, arrayAt } from '../src/nodes';
import {
  instanceWith,
  literalNode,
  literalOf,
  heldValue,
  attributeValue,
  listValue,
  containerValue,
  literalValue,
} from '../src/values';

/**
 * An instance always names the template it is an instance of; there is no
 * valid CEDAR instance without one. Fixtures that stand in for what a host page
 * injects have to be valid instances too.
 */
const TEMPLATE_IRI = 'https://repo.metadatacenter.org/templates/fixture';
const INSTANCE_IRI = 'https://example.org/i/1';

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

/** One multi element, `minItems` occurrences to start, each holding two fields. */
const multiElementTemplate = (minItems = 1) =>
  buildTemplate({
    name: `ir_multi_${minItems}`,
    elements: [
      {
        name: 'author',
        cardinality: 'multi',
        minItems,
        maxItems: 9,
        children: [
          { kind: TEXT, name: 'name' },
          { kind: TEXT, name: 'email' },
        ],
      },
    ],
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const countOf = (driver: CeeDriver, component: any): number =>
  infoOf(driver.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(component), component)
    .currentCount;

describe('an instance wider than its template', () => {
  /**
   * REGRESSION SURFACE: the branch that grows the info tree for an occurrence
   * the template did not pre-build had never run. `buildRecursively` creates
   * `minItems` occurrences; anything beyond that has to be created while
   * reading, and every earlier test happened to load an instance with exactly
   * `minItems`.
   */
  it('restores every occurrence the instance holds, not just minItems', () => {
    const template = multiElementTemplate(1);
    const first = new CeeDriver(template);
    const author = first.findOrThrow(['_author']);

    first.setValue(['_author', '_name'], TEXT, 'Ada');
    first.handlerContext.addMultiInstance(author);
    first.setValue(['_author', '_name'], TEXT, 'Grace');
    first.handlerContext.addMultiInstance(author);
    first.setValue(['_author', '_name'], TEXT, 'Barbara');
    expect(countOf(first, author)).toBe(3);

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    reloaded.expectNoErrors('reloading a three-occurrence instance');

    expect(countOf(reloaded, reloaded.findOrThrow(['_author']))).toBe(3);
  });

  it('brings the values back with the occurrences', () => {
    const template = multiElementTemplate(1);
    const first = new CeeDriver(template);
    const author = first.findOrThrow(['_author']);

    first.setValue(['_author', '_name'], TEXT, 'Ada');
    first.handlerContext.addMultiInstance(author);
    first.setValue(['_author', '_name'], TEXT, 'Grace');

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    const names = arrayAt(reloaded.extract, '_author').map((o) => heldValue(objectAt(o).values._name));
    expect(names).toEqual(['Ada', 'Grace']);
  });

  /**
   * The cursor lands on the first occurrence, not wherever the previous
   * session left it. Anything else would make a reload silently show a
   * different page of the form than the one the URL implies.
   */
  it('leaves the cursor on the first occurrence', () => {
    const template = multiElementTemplate(1);
    const first = new CeeDriver(template);
    const author = first.findOrThrow(['_author']);
    first.setValue(['_author', '_name'], TEXT, 'Ada');
    first.handlerContext.addMultiInstance(author);
    first.setValue(['_author', '_name'], TEXT, 'Grace');

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    const reloadedAuthor = reloaded.findOrThrow(['_author']);
    const info = infoOf(
      reloaded.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(reloadedAuthor),
      reloadedAuthor,
    );
    expect(info.currentIndex).toBe(0);
  });
});

describe('an instance narrower than its template', () => {
  /**
   * The mirror case, and the one that decides whether `minItems` is a
   * guarantee or a default. It is a default: the instance wins, and a saved
   * document with fewer occurrences than the template now demands comes back
   * as it was saved rather than being padded.
   */
  it('does not pad up to minItems', () => {
    const template = multiElementTemplate(3);
    const first = new CeeDriver(template);
    expect(countOf(first, first.findOrThrow(['_author']))).toBe(3);

    // A document saved before the template raised its minimum.
    const instance = JSON.parse(JSON.stringify(first.metadata));
    instance._author = [instance._author[0]];

    const reloaded = new CeeDriver(template, { instance });
    reloaded.expectNoErrors('reloading an under-filled instance');
    expect(countOf(reloaded, reloaded.findOrThrow(['_author']))).toBe(1);
  });
});

describe('occurrences that are not all alike', () => {
  /**
   * REGRESSION SURFACE: the branch that adds a missing child to an occurrence
   * that already exists. Reached when one occurrence carries a field another
   * does not — which a hand-edited or partially-migrated instance easily does,
   * and which no generated fixture produced.
   */
  it('reconciles an occurrence that is missing a field the others have', () => {
    const template = multiElementTemplate(1);
    // Built uneven rather than built even and then cut down. The second
    // occurrence simply has no `_email`, which is the shape under test — a
    // document saved before the field existed — and saying so directly beats
    // deleting a property out of a document the editor produced.
    const instance = instanceWith(
      TEMPLATE_IRI,
      {
        _author: listValue(
          containerValue({ _name: literalValue('Ada'), _email: literalValue('ada@example.org') }),
          containerValue({ _name: literalValue('Grace') }),
        ),
      },
      INSTANCE_IRI,
    );

    const reloaded = new CeeDriver(template, { instance });
    reloaded.expectNoErrors('reloading an uneven instance');
    expect(countOf(reloaded, reloaded.findOrThrow(['_author']))).toBe(2);
    expect(heldValue(objectAt(arrayAt(reloaded.extract, '_author')[0]).values._email)).toBe('ada@example.org');
  });

  it('survives an occurrence that is empty', () => {
    const template = multiElementTemplate(1);
    const first = new CeeDriver(template);
    const author = first.findOrThrow(['_author']);
    first.setValue(['_author', '_name'], TEXT, 'Ada');
    first.handlerContext.addMultiInstance(author);

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    reloaded.expectNoErrors('reloading an instance with an empty occurrence');
    expect(countOf(reloaded, reloaded.findOrThrow(['_author']))).toBe(2);
  });
});

describe('elements are walked into, not mistaken for values', () => {
  /**
   * REGRESSION: CEE stamps every element occurrence it writes with an `@id` of
   * its own — a `template-element-instances/…` IRI. The reader decided whether
   * an instance node was a field's value or an element by asking whether it
   * had an `@id`, so every element in an instance CEE had saved looked like an
   * IRI-valued field, and the reader stopped at it instead of walking in.
   *
   * The occurrence count of the element itself still came back right, which is
   * why this survived: it is only what is *inside* an element that was lost.
   * Save three tags inside an element, reload, and the pager offers one. The
   * other two are still in the data and unreachable from the UI.
   *
   * The two are now told apart by whether the node holds anything beyond the
   * value keys. An element carries `@context` and its children, so it does.
   */
  it('restores a multi field inside a single element', () => {
    const template = buildTemplate({
      name: 'ir_single_el',
      elements: [
        { name: 'el', children: [{ kind: TEXT, name: 'tag', cardinality: 'multi', minItems: 1, maxItems: 9 }] },
      ],
    });
    const first = new CeeDriver(template);
    const tag = first.findOrThrow(['_el', '_tag']);
    first.setValue(['_el', '_tag'], TEXT, 'one');
    first.handlerContext.addMultiInstance(tag);
    first.setValue(['_el', '_tag'], TEXT, 'two');
    first.handlerContext.addMultiInstance(tag);
    first.setValue(['_el', '_tag'], TEXT, 'three');

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    reloaded.expectNoErrors('reloading a multi field inside an element');
    expect(countOf(reloaded, reloaded.findOrThrow(['_el', '_tag']))).toBe(3);
  });

  it('restores a multi field inside a multi element, per occurrence', () => {
    const template = buildTemplate({
      name: 'ir_multi_el_field',
      elements: [
        {
          name: 'author',
          cardinality: 'multi',
          minItems: 1,
          maxItems: 9,
          children: [{ kind: TEXT, name: 'tag', cardinality: 'multi', minItems: 1, maxItems: 9 }],
        },
      ],
    });
    const first = new CeeDriver(template);
    const author = first.findOrThrow(['_author']);
    const tag = first.findOrThrow(['_author', '_tag']);

    first.setValue(['_author', '_tag'], TEXT, 'a1');
    first.handlerContext.addMultiInstance(tag);
    first.setValue(['_author', '_tag'], TEXT, 'a2');
    first.handlerContext.addMultiInstance(author);
    first.setValue(['_author', '_tag'], TEXT, 'b1');

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    reloaded.expectNoErrors('reloading a multi field inside a multi element');

    const service = reloaded.handlerContext.multiInstanceObjectService;
    const reloadedAuthor = reloaded.findOrThrow(['_author']);
    const reloadedTag = reloaded.findOrThrow(['_author', '_tag']);
    expect(infoOf(service.getMultiInstanceInfoForComponent(reloadedTag), reloadedTag).currentCount).toBe(2);
    service.setCurrentIndex(reloadedAuthor, 1);
    expect(infoOf(service.getMultiInstanceInfoForComponent(reloadedTag), reloadedTag).currentCount).toBe(1);
  });

  /**
   * The other half of the same test: a genuine IRI-valued field must still be
   * read as a field. A controlled term is `@id` plus `rdfs:label` and nothing
   * else, so it stays on the value side of the line.
   */
  it('still treats a controlled term as a value', () => {
    const CONTROLLED: FieldKind = {
      key: 'ct',
      inputType: 'controlled',
      make: () => CedarBuilders.controlledTermFieldBuilder(),
      isStatic: false,
      write: 'controlled',
      sample: 'term',
      configure: (b: unknown) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (b as any).addOntology(
          new ControlledTermOntologyBuilder()
            .withAcronym('MESH')
            .withName('Medical Subject Headings')
            .withUri(new Iri('https://data.bioontology.org/ontologies/MESH'))
            .build(),
        ),
    };
    const template = buildTemplate({
      name: 'ir_ct',
      children: [{ kind: CONTROLLED, name: 'ct', cardinality: 'multi', minItems: 1, maxItems: 9 }],
    });
    const first = new CeeDriver(template);
    first.setValue(['_ct'], CONTROLLED, 'term');

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    reloaded.expectNoErrors('reloading a controlled term');
    expect(countOf(reloaded, reloaded.findOrThrow(['_ct']))).toBe(1);
  });
});

describe('nested multi elements', () => {
  /**
   * Two cursors deep. Reading has to splice an `@#index[N]#@` segment for each
   * level, and the inner occurrence counts are per outer occurrence rather than
   * shared — a detail the string-path encoding makes easy to get wrong.
   */
  it('restores per-occurrence inner counts independently', () => {
    const template = buildTemplate({
      name: 'ir_nested',
      elements: [
        {
          name: 'author',
          cardinality: 'multi',
          minItems: 1,
          maxItems: 9,
          elements: [
            {
              name: 'affil',
              cardinality: 'multi',
              minItems: 1,
              maxItems: 9,
              children: [{ kind: TEXT, name: 'org' }],
            },
          ],
        },
      ],
    });

    const first = new CeeDriver(template);
    const author = first.findOrThrow(['_author']);
    const affil = first.findOrThrow(['_author', '_affil']);

    // First author: two affiliations.
    first.setValue(['_author', '_affil', '_org'], TEXT, 'A1');
    first.handlerContext.addMultiInstance(affil);
    first.setValue(['_author', '_affil', '_org'], TEXT, 'A2');
    // Second author: one.
    first.handlerContext.addMultiInstance(author);
    first.setValue(['_author', '_affil', '_org'], TEXT, 'B1');

    const instance = first.metadata;
    expect(instance._author[0]._affil).toHaveLength(2);
    expect(instance._author[1]._affil).toHaveLength(1);

    const reloaded = new CeeDriver(template, { instance });
    reloaded.expectNoErrors('reloading nested multi elements');

    const reloadedAuthor = reloaded.findOrThrow(['_author']);
    const service = reloaded.handlerContext.multiInstanceObjectService;
    expect(infoOf(service.getMultiInstanceInfoForComponent(reloadedAuthor), reloadedAuthor).currentCount).toBe(2);

    // The inner count is read through the outer cursor, so move it and ask again.
    const reloadedAffil = reloaded.findOrThrow(['_author', '_affil']);
    expect(infoOf(service.getMultiInstanceInfoForComponent(reloadedAffil), reloadedAffil).currentCount).toBe(2);
    service.setCurrentIndex(reloadedAuthor, 1);
    expect(infoOf(service.getMultiInstanceInfoForComponent(reloadedAffil), reloadedAffil).currentCount).toBe(1);
  });
});

describe('deleting occurrences', () => {
  /**
   * REGRESSION SURFACE: the cursor clamp. Deleting while parked on the last
   * occurrence leaves `currentIndex` past the end, and every later path
   * resolution goes through that index. The clamp had no test.
   */
  it('steps the cursor back when the last occurrence goes', () => {
    const driver = new CeeDriver(multiElementTemplate(1));
    const author = driver.findOrThrow(['_author']);
    const service = driver.handlerContext.multiInstanceObjectService;

    driver.handlerContext.addMultiInstance(author);
    driver.handlerContext.addMultiInstance(author);
    expect(infoOf(service.getMultiInstanceInfoForComponent(author), author).currentIndex).toBe(2);

    driver.handlerContext.deleteMultiInstance(author);
    const info = infoOf(service.getMultiInstanceInfoForComponent(author), author);
    expect(info.currentCount).toBe(2);
    expect(info.currentIndex, 'cursor left pointing past the end').toBe(1);
  });

  it('leaves the cursor alone when an earlier occurrence goes', () => {
    const driver = new CeeDriver(multiElementTemplate(1));
    const author = driver.findOrThrow(['_author']);
    const service = driver.handlerContext.multiInstanceObjectService;

    driver.handlerContext.addMultiInstance(author);
    driver.handlerContext.addMultiInstance(author);
    service.setCurrentIndex(author, 0);

    driver.handlerContext.deleteMultiInstance(author);
    const info = infoOf(service.getMultiInstanceInfoForComponent(author), author);
    expect(info.currentCount).toBe(2);
    expect(info.currentIndex).toBe(0);
  });

  it('writes to the right occurrence after a delete', () => {
    const driver = new CeeDriver(multiElementTemplate(1));
    const author = driver.findOrThrow(['_author']);

    driver.setValue(['_author', '_name'], TEXT, 'Ada');
    driver.handlerContext.addMultiInstance(author);
    driver.setValue(['_author', '_name'], TEXT, 'Grace');
    driver.handlerContext.addMultiInstance(author);
    driver.setValue(['_author', '_name'], TEXT, 'Barbara');

    driver.handlerContext.deleteMultiInstance(author);
    driver.setValue(['_author', '_name'], TEXT, 'Katherine');
    driver.expectNoErrors('writing after a delete');

    const names = arrayAt(driver.extract, '_author').map((o) => heldValue(objectAt(o).values._name));
    expect(names).toEqual(['Ada', 'Katherine']);
  });
});

describe('attribute values, read back', () => {
  /**
   * Attribute values are the shape that makes instance reading awkward: the
   * field's own slot holds a list of *names*, and the values those names point
   * at are properties of the enclosing object rather than of the field. A
   * reader has to report both — the field, so the pager knows how many
   * attributes there are, and each named attribute, so its own slot exists.
   *
   * The live editing path is covered in `attribute-values.spec.ts`. This is the
   * reload path: the model reader pairs names with their values, and the CEE
   * deserializer restores the typed name list plus sibling values that its pager
   * and mutation handlers edit.
   */
  const attributeTemplate = () => buildTemplate({ name: 'ir_av', children: [{ kind: ATTR, name: 'av' }] });

  const withTwoAttributes = () => {
    const template = attributeTemplate();
    const first = new CeeDriver(template);
    const component = first.findOrThrow(['_av']);
    first.handlerContext.addMultiInstance(component);
    first.handlerContext.changeAttributeValue(component, 'colour', 'blue');
    first.handlerContext.addMultiInstance(component);
    first.handlerContext.changeAttributeValue(component, 'size', 'large');
    return { template, instance: first.metadata };
  };

  it('restores both attributes', () => {
    const { template, instance } = withTwoAttributes();
    const reloaded = new CeeDriver(template, { instance });
    reloaded.expectNoErrors('reloading two attribute values');

    expect(countOf(reloaded, reloaded.findOrThrow(['_av']))).toBe(2);
    expect(heldValue(reloaded.extract.values._av)).toEqual(['colour', 'size']);
    expect(attributeValue(reloaded.extract, '_av', 'colour')).toBe('blue');
    expect(attributeValue(reloaded.extract, '_av', 'size')).toBe('large');
  });

  it('restores the occurrence list shape the pager iterates', () => {
    const { template, instance } = withTwoAttributes();
    const reloaded = new CeeDriver(template, { instance });

    expect(arrayAt(reloaded.fullData, '_av').map(heldValue)).toEqual(['colour', 'size']);
  });

  it('can rename and edit an attribute after the instance is reloaded', () => {
    const { template, instance } = withTwoAttributes();
    const reloaded = new CeeDriver(template, { instance });
    const component = reloaded.findOrThrow(['_av']);

    reloaded.handlerContext.changeAttributeValue(component, 'hue', 'cyan');
    reloaded.expectNoErrors('editing a reloaded attribute value');

    expect(heldValue(reloaded.extract.values._av)).toEqual(['hue', 'size']);
    expect(attributeValue(reloaded.extract, '_av', 'hue')).toBe('cyan');
    expect(reloaded.emitted._av).toEqual(['hue', 'size']);
    expect(reloaded.emitted.hue).toEqual({ '@value': 'cyan' });
    expect(reloaded.emitted.colour).toBeUndefined();
  });

  it('restores attributes inside an element', () => {
    const template = buildTemplate({
      name: 'ir_av_el',
      elements: [{ name: 'el', children: [{ kind: ATTR, name: 'av' }] }],
    });
    const first = new CeeDriver(template);
    const component = first.findOrThrow(['_el', '_av']);
    first.handlerContext.addMultiInstance(component);
    first.handlerContext.changeAttributeValue(component, 'colour', 'blue');

    const reloaded = new CeeDriver(template, { instance: first.metadata });
    reloaded.expectNoErrors('reloading an attribute inside an element');
    expect(countOf(reloaded, reloaded.findOrThrow(['_el', '_av']))).toBe(1);
    const element = objectAt(reloaded.extract, '_el');
    expect(arrayAt(element, '_av').map(heldValue)).toEqual(['colour']);
    expect(attributeValue(element, '_av', 'colour')).toBe('blue');
  });
});

describe('slots that are empty', () => {
  /**
   * A multi field nobody filled serialises as `[]`. The slot still has to be
   * recorded — with a count of zero — or the pager has no entry for a field
   * the form is about to render.
   */
  it('empties a slot the template would have started at two', () => {
    const template = buildTemplate({
      name: 'ir_empty',
      children: [{ kind: TEXT, name: 'tag', cardinality: 'multi', minItems: 2, maxItems: 9 }],
    });
    // From the template alone the pager offers two pages.
    expect(countOf(new CeeDriver(template), new CeeDriver(template).findOrThrow(['_tag']))).toBe(2);

    // The instance says otherwise, and the instance wins.
    const first = new CeeDriver(template);
    const instance = JSON.parse(JSON.stringify(first.metadata));
    instance._tag = [];

    const reloaded = new CeeDriver(template, { instance });
    reloaded.expectNoErrors('reloading an emptied multi field');

    const slot = infoOf(reloaded.handlerContext.multiInstanceObjectService.getDataPathNode(['_tag']));
    expect(slot.currentCount).toBe(0);
    expect(slot.currentIndex).toBe(-1);
  });
});

describe('an attribute name with nothing behind it', () => {
  /**
   * An attribute-value slot can hold a name that no property answers to — `['']`
   * with no matching key, which an injected instance can easily carry. It is not
   * an attribute: there is nothing to show and nothing to edit, so the field
   * reports no occurrences and the pager offers no page.
   *
   * Worth stating because the obvious alternative is to count the array, which
   * is what CEE's original walk did, and which leaves the pager offering a page
   * that renders nothing.
   */
  it('is not counted as an attribute', () => {
    const template = buildTemplate({ name: 'ir_blank_attr', children: [{ kind: ATTR, name: 'f' }] });
    const driver = new CeeDriver(template, {
      instance: instanceWith(TEMPLATE_IRI, { _f: [''] }, 'https://example.org/i/1'),
    });
    expect(countOf(driver, driver.findOrThrow(['_f']))).toBe(0);
  });

  it('is counted as soon as the name has a value behind it', () => {
    const template = buildTemplate({ name: 'ir_named_attr', children: [{ kind: ATTR, name: 'f' }] });
    const driver = new CeeDriver(template, {
      // The name list and the value it points at are written by hand: an attribute
      // value's property is minted from the user's text, which is not something a
      // builder can be asked for.
      instance: {
        ...instanceWith(TEMPLATE_IRI, {}, INSTANCE_IRI),
        _f: ['colour'],
        colour: literalNode('blue'),
      },
    });
    expect(countOf(driver, driver.findOrThrow(['_f']))).toBe(1);
  });
});

describe('no template at all', () => {
  /**
   * A host page can set `templateObject` to null — before its fetch resolves,
   * or after a failed one. CEE answers with a `NullTemplate`, which is not a
   * `CedarTemplate` and has no children, and every downstream pass has to
   * tolerate it. Nothing exercised that path.
   */
  it('produces an empty representation rather than throwing', () => {
    expect(() => new CeeDriver(null as unknown as object)).not.toThrow();

    const driver = new CeeDriver(null as unknown as object);
    expect(driver.representation.className).toBe('NullTemplate');
    expect(driver.representation.children).toEqual([]);
    driver.expectNoErrors('building from a null template');
  });
});
