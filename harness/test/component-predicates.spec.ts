/**
 * The two questions the rest of the domain layer asks about a component.
 *
 * `ComponentTypeHandler` answers what a component *is* — field or element,
 * single or multi, static content or not — and almost everything that walks the
 * tree branches on one of its answers. `OccurrenceSelectors` answers which
 * occurrence of a multi component to act on.
 *
 * Neither had a test. Both are small enough that this looks like ceremony, and
 * that is exactly why nothing covered them: the predicates are one-liners over
 * `instanceof`, so a wrong one reads as correct and fails somewhere else
 * entirely. Their branch coverage was the shortfall that put the handler
 * directory under its floor.
 */
import { describe, expect, it } from 'vitest';
import { CeeDriver } from '../src/driver';
import { buildTemplate } from '../src/generate';
import { FIELD_KINDS } from '../src/axes';
import { ComponentTypeHandler } from '@cee/handler/component-type.handler';
import { OccurrenceSelectors } from '@cee/handler/occurrence-selector';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;

/** One of everything the predicates discriminate between. */
const mixedTemplate = () =>
  buildTemplate({
    name: 'predicates',
    children: [
      { kind: kind('textfield'), name: 'single' },
      { kind: kind('textfield'), name: 'repeated', cardinality: 'multi' },
      { kind: kind('image'), name: 'picture' },
      { kind: kind('youtube'), name: 'video' },
      { kind: kind('richtext'), name: 'prose' },
    ],
    elements: [
      { name: 'group', children: [{ kind: kind('textfield'), name: 'inside' }] },
      { name: 'groups', cardinality: 'multi', children: [{ kind: kind('textfield'), name: 'within' }] },
    ],
  });

describe('what a component is', () => {
  const driver = new CeeDriver(mixedTemplate());
  const at = (path: string[]) => driver.findOrThrow(path);

  it('tells the three static content kinds apart from each other', () => {
    expect(ComponentTypeHandler.isImage(at(['_picture']))).toBe(true);
    expect(ComponentTypeHandler.isYoutube(at(['_picture']))).toBe(false);
    expect(ComponentTypeHandler.isRichText(at(['_picture']))).toBe(false);

    expect(ComponentTypeHandler.isYoutube(at(['_video']))).toBe(true);
    expect(ComponentTypeHandler.isImage(at(['_video']))).toBe(false);

    expect(ComponentTypeHandler.isRichText(at(['_prose']))).toBe(true);
    expect(ComponentTypeHandler.isYoutube(at(['_prose']))).toBe(false);
  });

  it('says an ordinary field is none of them', () => {
    for (const ask of [ComponentTypeHandler.isImage, ComponentTypeHandler.isYoutube, ComponentTypeHandler.isRichText]) {
      expect(ask.call(ComponentTypeHandler, at(['_single']))).toBe(false);
    }
    expect(ComponentTypeHandler.isStaticContentComponent(at(['_single']))).toBe(false);
    expect(ComponentTypeHandler.isStaticContentComponent(at(['_prose']))).toBe(true);
  });

  /** The predicate a first child is asked about, having no predecessor. */
  it('says an absent component is not static content', () => {
    expect(ComponentTypeHandler.isStaticContentComponent(null)).toBe(false);
    expect(ComponentTypeHandler.isImage(null)).toBe(false);
  });

  it('separates fields from elements, whatever their cardinality', () => {
    for (const path of [['_single'], ['_repeated']]) {
      expect(ComponentTypeHandler.isField(at(path))).toBe(true);
      expect(ComponentTypeHandler.isElement(at(path))).toBe(false);
    }
    for (const path of [['_group'], ['_groups']]) {
      expect(ComponentTypeHandler.isElement(at(path))).toBe(true);
      expect(ComponentTypeHandler.isField(at(path))).toBe(false);
    }
  });

  /**
   * `isField` asks whether a component holds a value, not whether the template
   * called it a field. Static content is a `StaticFieldComponent` and is
   * neither of the two the predicate names, so it is not one — which is what
   * keeps an image out of the paths that read and write instance data.
   */
  it('says static content is neither a field nor an element', () => {
    expect(ComponentTypeHandler.isField(at(['_picture']))).toBe(false);
    expect(ComponentTypeHandler.isElement(at(['_picture']))).toBe(false);
    expect(ComponentTypeHandler.isFieldOrElement(at(['_picture']))).toBe(false);
    expect(ComponentTypeHandler.isMulti(at(['_picture']))).toBe(false);
  });

  it('counts both repeated kinds as multi and neither single one', () => {
    expect(ComponentTypeHandler.isMulti(at(['_repeated']))).toBe(true);
    expect(ComponentTypeHandler.isMulti(at(['_groups']))).toBe(true);
    expect(ComponentTypeHandler.isMulti(at(['_single']))).toBe(false);
    expect(ComponentTypeHandler.isMulti(at(['_group']))).toBe(false);
  });

  /** The template itself, which the predicates take as a component like any other. */
  const templateComponent = () => {
    const template = driver.dataContext.templateRepresentation;
    if (template === null) {
      throw new Error('the driver parsed no template');
    }
    return template;
  };

  /** A container holds children; the template is one, and so is either element. */
  it('counts the template and both elements as containers, and no field', () => {
    expect(ComponentTypeHandler.isContainerComponent(templateComponent())).toBe(true);
    expect(ComponentTypeHandler.isContainerComponent(at(['_group']))).toBe(true);
    expect(ComponentTypeHandler.isContainerComponent(at(['_groups']))).toBe(true);
    expect(ComponentTypeHandler.isContainerComponent(at(['_single']))).toBe(false);

    expect(ComponentTypeHandler.isFieldOrElement(at(['_single']))).toBe(true);
    expect(ComponentTypeHandler.isFieldOrElement(at(['_groups']))).toBe(true);
    expect(ComponentTypeHandler.isFieldOrElement(templateComponent())).toBe(false);
  });
});

describe('which occurrence to act on', () => {
  it('follows the cursor of the component the user is looking at', () => {
    const driver = new CeeDriver(mixedTemplate());
    const groups = driver.findOrThrow(['_groups']);
    const selector = OccurrenceSelectors.fromCursor(driver.handlerContext.multiInstanceObjectService);

    expect(selector(groups)).toBe(0);

    driver.handlerContext.addMultiInstance(groups);

    expect(OccurrenceSelectors.fromCursor(driver.handlerContext.multiInstanceObjectService)(groups)).toBe(1);
  });

  /**
   * Cursors are held per path, so a component at a path this form does not have
   * has no cursor to read. Answering `null` is what lets a caller fall back
   * rather than resolve against an index that means nothing here.
   */
  it('answers null for a component at a path this form does not have', () => {
    const mine = new CeeDriver(mixedTemplate());
    const other = new CeeDriver(
      buildTemplate({
        name: 'elsewhere',
        elements: [{ name: 'absent', cardinality: 'multi', children: [{ kind: kind('textfield'), name: 'within' }] }],
      }),
    );
    const selector = OccurrenceSelectors.fromCursor(mine.handlerContext.multiInstanceObjectService);

    expect(selector(other.findOrThrow(['_absent']))).toBeNull();
  });
});
