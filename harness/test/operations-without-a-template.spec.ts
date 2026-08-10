/**
 * What the handlers do when asked to work before a template has been set.
 *
 * Every mutation and every path lookup starts from `templateRepresentation`, and
 * every cursor move starts from a node in the multi-instance info tree. Both are
 * absent until a template arrives — and a host controls when that happens, since
 * `templateJsonObject`, `instanceJsonObject` and the config all arrive as separate
 * `@Input`s in whatever order the embedding page sets them.
 *
 * So this is not a hypothetical state; it is the state CEE starts in. What it owes
 * there is to do nothing, rather than throw at whatever the walk dereferences
 * first. These tests hold each of those doors shut.
 */
import { describe, expect, it } from 'vitest';
import { FIELD_KINDS } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { DataContext } from '../../src/app/modules/shared/util/data-context';
import { HandlerContext } from '../../src/app/modules/shared/util/handler-context';
import { RecordingMessageHandler } from '../src/driver';
import { FieldComponent } from '../../src/app/modules/shared/models/component/field-component.model';
import { MultiComponent } from '../../src/app/modules/shared/models/component/multi-component.model';

const kind = (inputType: string) => FIELD_KINDS.find((k) => k.inputType === inputType)!;
const TEXT = kind('textfield');

/**
 * A component tree built from a real template, and a handler context that has never
 * seen one — which is what puts a valid component in front of an empty context.
 */
const emptyContextAnd = (): { handlerContext: HandlerContext; field: FieldComponent; multi: MultiComponent } => {
  const built = new CeeDriver(
    buildTemplate({
      name: 'no_template_yet',
      children: [
        { kind: TEXT, name: 'a' },
        { kind: TEXT, name: 'm', cardinality: 'multi', minItems: 1 },
      ],
    }),
  );
  const handlerContext = new HandlerContext(new DataContext(), new RecordingMessageHandler());
  return {
    handlerContext,
    field: built.findOrThrow(['_a']) as FieldComponent,
    multi: built.findOrThrow(['_m']) as MultiComponent,
  };
};

describe('editing before a template is set', () => {
  it('changing a value does nothing rather than throwing', () => {
    const { handlerContext, field } = emptyContextAnd();
    expect(() => handlerContext.changeValue(field, 'typed')).not.toThrow();
  });

  it('changing a list does nothing rather than throwing', () => {
    const { handlerContext, field } = emptyContextAnd();
    expect(() => handlerContext.changeListValue(field, ['a', 'b'])).not.toThrow();
  });

  it('changing a controlled value does nothing rather than throwing', () => {
    const { handlerContext, field } = emptyContextAnd();
    expect(() => handlerContext.changeControlledValue(field, 'https://example.org/t/1', 'Term')).not.toThrow();
  });

  it('changing an attribute value does nothing rather than throwing', () => {
    const { handlerContext, field } = emptyContextAnd();
    expect(() => handlerContext.changeAttributeValue(field, 'key', 'value')).not.toThrow();
  });

  it('deleting an attribute value does nothing rather than throwing', () => {
    const { handlerContext, field } = emptyContextAnd();
    expect(() => handlerContext.deleteAttributeValue(field, 'key')).not.toThrow();
  });
});

describe('reading a path before a template is set', () => {
  it('resolves to nothing rather than throwing', () => {
    const { handlerContext, field } = emptyContextAnd();
    expect(handlerContext.getDataObjectNodeByPath(field.path)).toBeNull();
    expect(handlerContext.getParentDataObjectNodeByPath(field.path)).toBeNull();
    expect(handlerContext.getDataObjectNodeAt(field.path, [0])).toBeNull();
    expect(handlerContext.getParentDataObjectNodeAt(field.path, [0])).toBeNull();
  });
});

describe('building the quality report before a template is set', () => {
  it('produces an empty report rather than throwing', () => {
    const { handlerContext } = emptyContextAnd();
    expect(() => handlerContext.buildQualityReport()).not.toThrow();
  });
});

describe('naming fewer occurrences than the path has multi ancestors', () => {
  /**
   * `getDataObjectNodeAt` takes one index per multi ancestor, outermost first. A
   * caller that supplies too few runs the selector dry, and the walk stops rather
   * than guessing an occurrence — which is the whole reason the selector exists
   * separately from the cursor.
   */
  it('stops at the ancestor it has no index for', () => {
    const driver = new CeeDriver(
      buildTemplate({
        name: 'too_few_indices',
        elements: [{ name: 'el', cardinality: 'multi', minItems: 2, children: [{ kind: TEXT, name: 'inner' }] }],
      }),
    );
    const inner = driver.findOrThrow(['_el', '_inner']) as FieldComponent;

    expect(driver.handlerContext.getDataObjectNodeAt(inner.path, [0])).not.toBeUndefined();
    expect(driver.handlerContext.getDataObjectNodeAt(inner.path, [])).toBeNull();
  });
});

describe('a path naming a child that does not exist', () => {
  /**
   * The walks step from component to component by name, and a name that matches no
   * child ends the walk. Reachable from the host: `currentMetadata` is read by path,
   * and a page holding a path from a previous template will ask for one of these
   * after the template is replaced.
   */
  const nested = (): CeeDriver =>
    new CeeDriver(
      buildTemplate({
        name: 'bogus_path',
        elements: [{ name: 'el', children: [{ kind: TEXT, name: 'inner' }] }],
      }),
    );

  it('resolves to nothing rather than throwing', () => {
    const driver = nested();
    // The node is null — the walk reaches the element and asks for a child it does
    // not hold — while the *parent* is the element itself, which exists whether or
    // not the child does. Asserted as the two different answers they are.
    //
    // It used to be `undefined`, which is what indexing a plain object for a
    // missing key gives back. Asking a container answers null, and null is what
    // the walk's own signature has always promised.
    expect(driver.handlerContext.getDataObjectNodeByPath(['_el', 'no_such_child'])).toBeNull();
    expect(driver.handlerContext.getParentDataObjectNodeByPath(['_el', 'no_such_child'])).not.toBeNull();
  });

  it('writing to it does nothing rather than throwing', () => {
    const driver = nested();
    const field = driver.findOrThrow(['_el', '_inner']) as FieldComponent;
    // The component is real; the path it is asked to write at is not.
    const strayPath = ['_el', 'no_such_child'];
    const stray = { ...field, path: strayPath } as FieldComponent;
    expect(() => driver.handlerContext.changeValue(stray, 'typed')).not.toThrow();
  });
});

describe('moving occurrences before a template is set', () => {
  it('adding, copying and deleting all decline rather than throwing', () => {
    const { handlerContext, multi } = emptyContextAnd();
    expect(() => handlerContext.addMultiInstance(multi)).not.toThrow();
    expect(() => handlerContext.copyMultiInstance(multi)).not.toThrow();
    expect(() => handlerContext.deleteMultiInstance(multi)).not.toThrow();
  });

  it('setting the cursor declines rather than throwing', () => {
    const { handlerContext, multi } = emptyContextAnd();
    expect(() => handlerContext.setCurrentIndex(multi, 2)).not.toThrow();
  });

  /**
   * Through the handlers directly, because `HandlerContext` stops first — a copy
   * with no cursor becomes an add, and an add with no template returns. Each layer
   * has its own door and each one is worth holding shut: these two are also called
   * from `DataObjectStructureHandler`, which is reached by a different route.
   */
  it('the handlers decline on their own account, not only through the context', () => {
    const { handlerContext, multi } = emptyContextAnd();
    const info = handlerContext.multiInstanceObjectService;
    expect(() => info.multiInstanceItemCopy(multi)).not.toThrow();
    expect(() => info.multiInstanceItemDelete(multi)).not.toThrow();
    expect(() => info.multiInstanceItemAdd(multi)).not.toThrow();
  });
});
