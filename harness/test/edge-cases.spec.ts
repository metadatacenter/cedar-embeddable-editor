/**
 * Targeted tests for the parts of CEE that a cross-product sweep won't reach.
 *
 * Each block corresponds to a specific branch I could find no coverage for in
 * the existing suite (which is 40 files of `expect(component).toBeTruthy()`).
 * These are the behaviours most likely to break silently under refactoring.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { at, infoOf } from '../src/nodes';
import { linkNode, literalOf, termNode, heldValue, linkValue, termValue } from '../src/values';
import { JsonSchema } from 'cedar-model-typescript-library';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');
const LINK = kind('link');
const CONTROLLED = kind('controlled');
const PAGE_BREAK = kind('page-break');
const IMAGE = kind('image');
const ELEMENT_INSTANCE_IRI = 'https://repo.metadatacenter.org/template-element-instances/field-value';

describe('page break pagination', () => {
  /**
   * `TemplateRepresentationFactory.extractPageBreakPages` pads with
   * `EmptyTemplate` in two cases that are easy to regress: a trailing page
   * break, and consecutive page breaks (which yield n-1 blank pages).
   */
  it('produces a single page when there are no page breaks', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'pb_none',
        children: [
          { kind: TEXT, name: 'a' },
          { kind: TEXT, name: 'b' },
        ],
      }),
    );
    expect(driver.representation.pageBreakChildren).toHaveLength(1);
    expect(driver.representation.hasPageBreaks()).toBe(false);
  });

  it('splits into two pages around a single break', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'pb_one',
        children: [
          { kind: TEXT, name: 'a' },
          { kind: PAGE_BREAK, name: 'pb' },
          { kind: TEXT, name: 'b' },
        ],
      }),
    );
    expect(driver.representation.pageBreakChildren).toHaveLength(2);
    expect(driver.representation.hasPageBreaks()).toBe(true);
  });

  it('appends a blank page for a trailing break', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'pb_trailing',
        children: [
          { kind: TEXT, name: 'a' },
          { kind: PAGE_BREAK, name: 'pb' },
        ],
      }),
    );
    // Content page + the empty page the trailing break implies.
    expect(driver.representation.pageBreakChildren).toHaveLength(2);
  });

  it('inserts blank pages for consecutive breaks', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'pb_consecutive',
        children: [
          { kind: TEXT, name: 'a' },
          { kind: PAGE_BREAK, name: 'pb1' },
          { kind: PAGE_BREAK, name: 'pb2' },
          { kind: TEXT, name: 'b' },
        ],
      }),
    );
    // a | <blank> | b
    expect(driver.representation.pageBreakChildren).toHaveLength(3);
  });
});

describe('hidden fields', () => {
  /**
   * BEHAVIOUR CHANGE. `_ui.hidden` used to be applied by *removing* the child
   * at parse time, so the component was not merely invisible but unreachable —
   * and, because the instance builder walks the component tree, the property
   * was missing from the document as well. A template that hid a required
   * field could not produce a valid instance at all.
   *
   * The child is now kept and flagged. `hidden` is what the renderer skips on;
   * `hiddenInTemplate` records that the template is the reason, so the
   * empty-field pass cannot reveal it later. Covered in full by
   * `hidden-fields.spec.ts`.
   */
  it('stay in the component tree, flagged rather than removed', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'hidden',
        children: [
          { kind: TEXT, name: 'visible' },
          { kind: TEXT, name: 'invisible', hidden: true },
        ],
      }),
    );
    expect(driver.find(['_visible'])).toBeTruthy();

    const concealed = driver.find(['_invisible']);
    expect(concealed, 'the child is present').toBeTruthy();
    expect(concealed.hidden, 'and not rendered').toBe(true);
    expect(concealed.hiddenInTemplate, 'because the template says so').toBe(true);
  });

  it('so the instance keeps a slot for them', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'hidden_slot',
        children: [
          { kind: TEXT, name: 'visible' },
          { kind: TEXT, name: 'invisible', hidden: true },
        ],
      }),
    );
    expect(Object.keys(driver.extract)).toContain('_invisible');
  });
});

describe('static component collapsing', () => {
  /**
   * With `collapseStaticComponents`, a static content component immediately
   * preceding a field is removed from `children` and re-attached as that
   * field's `linkedStaticFieldComponent`, so the renderer draws them as one
   * unit. Off by default; the dev config turns it on.
   */
  it('leaves statics as siblings when disabled', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'collapse_off',
        children: [
          { kind: IMAGE, name: 'img' },
          { kind: TEXT, name: 'field' },
        ],
      }),
      { collapseStaticComponents: false },
    );
    expect(driver.find(['_img'])).toBeTruthy();
    expect(driver.findOrThrow(['_field']).linkedStaticFieldComponent).toBeFalsy();
  });

  it('attaches the static to the following field when enabled', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'collapse_on',
        children: [
          { kind: IMAGE, name: 'img' },
          { kind: TEXT, name: 'field' },
        ],
      }),
      { collapseStaticComponents: true },
    );
    expect(driver.find(['_img']), 'the static should have been absorbed').toBeNull();
    expect(driver.findOrThrow(['_field']).linkedStaticFieldComponent).toBeTruthy();
  });

  it('collapses static content inside nested elements too', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'collapse_nested',
        elements: [
          {
            name: 'details',
            children: [
              { kind: IMAGE, name: 'img' },
              { kind: TEXT, name: 'field' },
            ],
          },
        ],
      }),
      { collapseStaticComponents: true },
    );

    expect(driver.find(['_details', '_img']), 'the nested static should have been absorbed').toBeNull();
    expect(driver.findOrThrow(['_details', '_field']).linkedStaticFieldComponent).toBeTruthy();
  });
});

describe('multi-instance elements', () => {
  const multiElementTemplate = () =>
    buildTemplate({
      name: 'multi_el_t',
      elements: [
        {
          name: 'author',
          cardinality: 'multi',
          minItems: 2,
          children: [{ kind: TEXT, name: 'name' }],
        },
      ],
    });

  const countOf = (driver: CeeDriver, component: any) =>
    infoOf(driver.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(component), component)
      .currentCount;

  it('starts at minItems', () => {
    const driver = new CeeDriver(multiElementTemplate());
    expect(countOf(driver, driver.findOrThrow(['_author']))).toBe(2);
  });

  it('add / copy / delete keep the count consistent', () => {
    const driver = new CeeDriver(multiElementTemplate());
    const author = driver.findOrThrow(['_author']);

    driver.handlerContext.addMultiInstance(author);
    expect(countOf(driver, author)).toBe(3);

    driver.handlerContext.copyMultiInstance(author);
    expect(countOf(driver, author)).toBe(4);

    driver.handlerContext.deleteMultiInstance(author);
    expect(countOf(driver, author)).toBe(3);

    driver.expectNoErrors('multi-instance mutation');
  });

  /**
   * The load-bearing invariant. `getDataObjectNodeByPath` is not pure — it
   * resolves through each multi ancestor's `currentIndex`. If a mutation ever
   * bumps the index before writing the data (HandlerContext is careful to do
   * it the other way round), values land in the wrong slot and nothing
   * complains.
   */
  it('keeps per-page values independent', () => {
    const driver = new CeeDriver(multiElementTemplate());
    const author = driver.findOrThrow(['_author']);
    const nameField = driver.findOrThrow(['_author', '_name']);

    driver.handlerContext.setCurrentIndex(author, 0);
    driver.handlerContext.changeValue(nameField, 'first');

    driver.handlerContext.setCurrentIndex(author, 1);
    driver.handlerContext.changeValue(nameField, 'second');

    driver.handlerContext.setCurrentIndex(author, 0);
    expect(heldValue(driver.handlerContext.getDataObjectNodeByPath(['_author', '_name']))).toBe('first');

    driver.handlerContext.setCurrentIndex(author, 1);
    expect(heldValue(driver.handlerContext.getDataObjectNodeByPath(['_author', '_name']))).toBe('second');

    driver.expectNoErrors('per-page writes');
  });

  it('copying an instance mints fresh @ids rather than duplicating them', () => {
    const driver = new CeeDriver(multiElementTemplate());
    const author = driver.findOrThrow(['_author']);

    driver.handlerContext.copyMultiInstance(author);

    const authors = driver.metadata['_author'];
    const ids = authors.map((a: any) => a[JsonSchema.atId]).filter(Boolean);
    expect(new Set(ids).size, 'copied instances share an @id').toBe(ids.length);
  });

  it('copies a repeatable IRI field verbatim even when its value uses the element-instance namespace', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'copy_multi_link',
        children: [{ kind: LINK, name: 'reference', cardinality: 'multi', minItems: 1 }],
      }),
    );
    const reference = driver.findOrThrow(['_reference']);
    driver.handlerContext.changeValue(reference, ELEMENT_INSTANCE_IRI);

    driver.handlerContext.copyMultiInstance(reference);

    expect(driver.emitted._reference.map((value: any) => value[JsonSchema.atId])).toEqual([
      ELEMENT_INSTANCE_IRI,
      ELEMENT_INSTANCE_IRI,
    ]);
  });

  it('remints only element envelopes throughout a copied subtree', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'copy_nested_elements',
        elements: [
          {
            name: 'outer',
            cardinality: 'multi',
            minItems: 1,
            children: [{ kind: LINK, name: 'reference' }],
            elements: [
              {
                name: 'inner',
                children: [{ kind: LINK, name: 'innerReference' }],
              },
              {
                name: 'manyInner',
                cardinality: 'multi',
                minItems: 2,
                children: [{ kind: CONTROLLED, name: 'term' }],
              },
            ],
          },
        ],
      }),
    );
    driver.dataContext.mutate((instance: any) => {
      const outer = instance.values._outer[0];
      outer.setValue('_reference', linkValue(`${ELEMENT_INSTANCE_IRI}/outer-field`));
      outer.values._inner.setValue('_innerReference', linkValue(`${ELEMENT_INSTANCE_IRI}/inner-field`));
      outer.values._manyInner.forEach((inner: any, index: number) => {
        inner.setValue('_term', termValue(`${ELEMENT_INSTANCE_IRI}/term-${index}`, `Term ${index}`));
      });
    });

    const outerComponent = driver.findOrThrow(['_outer']);
    const before = driver.metadata._outer[0];
    driver.handlerContext.copyMultiInstance(outerComponent);
    const [source, copy] = driver.metadata._outer;

    expect(source[JsonSchema.atId]).toBe(before[JsonSchema.atId]);
    expect(copy[JsonSchema.atId]).not.toBe(source[JsonSchema.atId]);
    expect(copy._inner[JsonSchema.atId]).not.toBe(source._inner[JsonSchema.atId]);
    expect(copy._manyInner.map((inner: any) => inner[JsonSchema.atId])).not.toEqual(
      source._manyInner.map((inner: any) => inner[JsonSchema.atId]),
    );

    expect(copy._reference[JsonSchema.atId]).toBe(source._reference[JsonSchema.atId]);
    expect(copy._inner._innerReference[JsonSchema.atId]).toBe(source._inner._innerReference[JsonSchema.atId]);
    expect(copy._manyInner.map((inner: any) => inner._term)).toEqual(
      source._manyInner.map((inner: any) => inner._term),
    );
  });
});

describe('data quality report', () => {
  it('counts required fields and flips to valid once they are filled', () => {
    const template = buildTemplate({
      name: 'quality',
      children: [
        { kind: TEXT, name: 'req_a', required: true },
        { kind: TEXT, name: 'req_b', required: true },
        { kind: TEXT, name: 'optional' },
      ],
    });
    const driver = new CeeDriver(template);

    expect(driver.qualityReport.requiredFieldValueCount).toBe(2);
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(0);
    expect(driver.qualityReport.isValid).toBe(false);

    driver.setValue(['_req_a'], TEXT, 'filled a');
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(1);
    expect(driver.qualityReport.isValid).toBe(false);

    driver.setValue(['_req_b'], TEXT, 'filled b');
    expect(driver.qualityReport.nonNullRequiredFieldValueCount).toBe(2);
    expect(driver.qualityReport.isValid).toBe(true);
  });
});

describe('loading an existing instance', () => {
  /**
   * `MultiInstanceObjectHandler.updateFromInstanceExtractData` reconstructs
   * cardinality from loaded data, encoding array positions into paths as
   * `@#index[N]#@`. It is the most intricate untested code in the repo and is
   * only reachable when a template AND an instance arrive together.
   */
  it('recovers multi-instance counts from the instance, not the template', () => {
    const template = buildTemplate({
      name: 'reload',
      elements: [{ name: 'author', cardinality: 'multi', minItems: 1, children: [{ kind: TEXT, name: 'name' }] }],
    });

    // Build an instance with three authors by driving the editor, then reload it.
    const first = new CeeDriver(template);
    const author = first.findOrThrow(['_author']);
    first.handlerContext.addMultiInstance(author);
    first.handlerContext.addMultiInstance(author);
    const saved = first.metadata;
    expect(saved['_author']).toHaveLength(3);

    const reloaded = new CeeDriver(template, { instance: saved });
    const reloadedAuthor = reloaded.findOrThrow(['_author']);
    const info = infoOf(
      reloaded.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(reloadedAuthor),
      reloadedAuthor,
    );

    expect(info.currentCount, 'count came from the template minItems, not the loaded instance').toBe(3);
    reloaded.expectNoErrors('instance reload');
  });
});
