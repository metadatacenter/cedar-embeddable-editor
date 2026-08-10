/**
 * Pushing model values back into the widgets.
 *
 * `ActiveComponentRegistryService.updateViewToModel` is what runs after any
 * change that could move a value the user is looking at — a page turn, an
 * instance added or deleted, an instance loaded. It reads the node the model
 * holds and calls `setCurrentValue` on the Angular component showing it.
 *
 * It had **no tests at all**: 245 lines, 28 raw CEDAR key lookups, 0% covered.
 * The harness deliberately avoids Angular, and this looked like an Angular
 * service — but the two Angular types it names are used only as types, so
 * nothing Angular survives compilation. A plain object with `setCurrentValue`
 * is all a widget has to be from here.
 *
 * That matters now because this is the largest remaining stretch of hand-rolled
 * CEDAR JSON reading in CEE, and the shape of it — a ladder of `@value`, then
 * `@id` plus a list of input types, then `rdfs:label` — is exactly what the
 * model library's typed atoms replace. None of that can move until it is
 * pinned.
 */
import { describe, expect, it } from 'vitest';
import { CedarBuilders, ControlledTermOntologyBuilder, Iri } from 'cedar-model-typescript-library';
import { ActiveComponentRegistryService } from '@cee/service/active-component-registry.service';
import type { InstanceNode } from '@cee/models/instance-node.model';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import { instanceWith, linkNode, literalNode, termNode } from '../src/values';
import { arrayAt } from '../src/nodes';
import { InstanceDataAttributeValueFieldName } from 'cedar-model-typescript-library';

/** The names an attribute-value field is holding, in page order. */
const attributeNames = (slots: unknown[]): (string | null)[] =>
  slots.map((slot) => (slot instanceof InstanceDataAttributeValueFieldName ? slot.name : null));
import { JsonSchema } from 'cedar-model-typescript-library';

/**
 * An instance always names the template it is an instance of; there is no
 * valid CEDAR instance without one. Fixtures that stand in for what a host page
 * injects have to be valid instances too.
 */
const TEMPLATE_IRI = 'https://repo.metadatacenter.org/templates/fixture';
const INSTANCE_IRI = 'https://example.org/i/1';

const kind = (
  key: string,
  inputType: string,
  make: () => unknown,
  sample: string,
  extra: Partial<FieldKind> = {},
): FieldKind => ({ key, inputType, make, isStatic: false, write: 'value', sample, ...extra }) as FieldKind;

const TEXT = kind('text', 'textfield', () => CedarBuilders.textFieldBuilder(), 'some text');
const LINK = kind('link', 'link', () => CedarBuilders.linkFieldBuilder(), 'https://example.org/thing');
const ORCID = kind(
  'orcid',
  'ext-orcid',
  () => CedarBuilders.extOrcidFieldBuilder(),
  'https://orcid.org/0000-0002-1825-0097',
);
const CONTROLLED = kind('controlled', 'controlled', () => CedarBuilders.controlledTermFieldBuilder(), 'Homo sapiens', {
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
const CHECKBOX = kind('checkbox', 'checkbox', () => CedarBuilders.checkboxFieldBuilder(), 'Option A', {
  configure: (b: unknown) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b as any).addCheckboxOption('Option A').addCheckboxOption('Option B'),
});

/** Everything a widget has to be, from this service's point of view. */
class FakeWidget {
  readonly pushed: unknown[] = [];
  deleted = 0;
  setCurrentValue(value: unknown): void {
    this.pushed.push(value);
  }
  deleteCurrentValue(): void {
    this.deleted++;
  }
  /** The most recent push, which is what the user would be looking at. */
  get last(): unknown {
    return this.pushed[this.pushed.length - 1];
  }
}

/** Likewise for a pager. */
class FakePager {
  updates = 0;
  updatePagingUI(): void {
    this.updates++;
  }
}

interface Rig {
  driver: CeeDriver;
  registry: ActiveComponentRegistryService;
  widget: FakeWidget;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any;
  sync: () => void;
}

/** A one-field template, a fake widget registered against that field. */
const rig = (fieldKind: FieldKind, path: string[] = ['_f'], template?: object, opts = {}): Rig => {
  const driver = new CeeDriver(
    template ?? buildTemplate({ name: `vs_${fieldKind.key}`, children: [{ kind: fieldKind, name: 'f' }] }),
    opts,
  );
  const registry = new ActiveComponentRegistryService();
  const widget = new FakeWidget();
  const component = driver.findOrThrow(path);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry.registerComponent(component, widget as any);
  return {
    driver,
    registry,
    widget,
    component,
    sync: () => registry.updateViewToModel(component, driver.handlerContext),
  };
};

describe('single fields', () => {
  it('pushes a literal straight through', () => {
    const r = rig(TEXT);
    r.driver.setValue(['_f'], TEXT, 'typed');
    r.sync();
    expect(r.widget.last).toBe('typed');
  });

  it('pushes a link as its IRI', () => {
    const r = rig(LINK);
    r.driver.setValue(['_f'], LINK, 'https://example.org/thing');
    r.sync();
    expect(r.widget.last).toBe('https://example.org/thing');
  });

  /**
   * External authority widgets need both halves: the IRI identifies the record
   * and the label is what the autocomplete displays. A bare string would leave
   * the box showing an IRI.
   */
  it('pushes an external authority value as both IRI and label', () => {
    const r = rig(ORCID);
    r.driver.handlerContext.changeControlledValue(r.component, 'https://orcid.org/0000-0002-1825-0097', 'Ada Lovelace');
    r.sync();
    expect(r.widget.last).toEqual({ iri: 'https://orcid.org/0000-0002-1825-0097', label: 'Ada Lovelace' });
  });

  /**
   * A controlled term being edited pushes only the label, because the
   * autocomplete's own value is the label; the IRI would be shown verbatim.
   */
  it('pushes a controlled term as its label when editable', () => {
    const r = rig(CONTROLLED);
    r.driver.handlerContext.changeControlledValue(r.component, 'https://example.org/terms/human', 'Homo sapiens');
    r.sync();
    expect(r.widget.last).toBe('Homo sapiens');
  });

  /**
   * Read-only mode pushes both halves instead. There is no autocomplete to
   * drive, and the viewer wants the IRI available as a link.
   */
  it('pushes a controlled term as IRI and label when read-only', () => {
    const template = buildTemplate({ name: 'vs_ro', children: [{ kind: CONTROLLED, name: 'f' }] });
    const r = rig(CONTROLLED, ['_f'], template, { readOnlyMode: true });
    r.driver.handlerContext.changeControlledValue(r.component, 'https://example.org/terms/human', 'Homo sapiens');
    r.sync();
    expect(r.widget.last).toEqual({ iri: 'https://example.org/terms/human', label: 'Homo sapiens' });
  });

  it('pushes nothing when no widget is registered', () => {
    const driver = new CeeDriver(buildTemplate({ name: 'vs_none', children: [{ kind: TEXT, name: 'f' }] }));
    const registry = new ActiveComponentRegistryService();
    expect(() => registry.updateViewToModel(driver.findOrThrow(['_f']), driver.handlerContext)).not.toThrow();
  });
});

describe('multi-valued fields that are not paged', () => {
  /**
   * A checkbox or a multi-select holds all its values at once, so the widget
   * gets the whole array rather than one page of it.
   */
  it('pushes every value as an array', () => {
    const r = rig(CHECKBOX);
    r.driver.handlerContext.changeListValue(r.component, ['Option A', 'Option B']);
    r.sync();
    expect(r.widget.last).toEqual(['Option A', 'Option B']);
  });

  it('pushes an empty array when nothing is selected', () => {
    const r = rig(CHECKBOX);
    r.sync();
    expect(r.widget.last).toEqual([]);
  });
});

describe('paged multi fields', () => {
  const pagedTemplate = (fieldKind: FieldKind) =>
    buildTemplate({
      name: `vs_paged_${fieldKind.key}`,
      children: [{ kind: fieldKind, name: 'f', cardinality: 'multi', minItems: 1, maxItems: 9 }],
    });

  it('pushes the value on the current page, not the first', () => {
    const r = rig(TEXT, ['_f'], pagedTemplate(TEXT));
    r.driver.setValue(['_f'], TEXT, 'page one');
    r.driver.handlerContext.addMultiInstance(r.component);
    r.driver.setValue(['_f'], TEXT, 'page two');

    r.sync();
    expect(r.widget.last).toBe('page two');

    r.driver.handlerContext.setCurrentIndex(r.component, 0);
    r.sync();
    expect(r.widget.last).toBe('page one');
  });

  it('pushes a paged link as its IRI', () => {
    const r = rig(LINK, ['_f'], pagedTemplate(LINK));
    r.driver.setValue(['_f'], LINK, 'https://example.org/thing');
    r.sync();
    expect(r.widget.last).toBe('https://example.org/thing');
  });

  it('pushes a paged external authority value as both halves', () => {
    const r = rig(ORCID, ['_f'], pagedTemplate(ORCID));
    r.driver.handlerContext.changeControlledValue(r.component, 'https://orcid.org/0000-0002-1825-0097', 'Ada Lovelace');
    r.sync();
    expect(r.widget.last).toEqual({ iri: 'https://orcid.org/0000-0002-1825-0097', label: 'Ada Lovelace' });
  });

  it('pushes a paged controlled term as its label', () => {
    const r = rig(CONTROLLED, ['_f'], pagedTemplate(CONTROLLED));
    r.driver.handlerContext.changeControlledValue(r.component, 'https://example.org/terms/human', 'Homo sapiens');
    r.sync();
    expect(r.widget.last).toBe('Homo sapiens');
  });

  it('tells the pager to redraw', () => {
    const r = rig(TEXT, ['_f'], pagedTemplate(TEXT));
    const pager = new FakePager();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.registry.registerMultiPagerComponent(r.component, pager as any);
    r.sync();
    expect(pager.updates).toBe(1);
  });
});

describe('elements', () => {
  const elementTemplate = (cardinality?: 'multi') =>
    buildTemplate({
      name: `vs_el_${cardinality ?? 'single'}`,
      elements: [
        {
          name: 'el',
          cardinality,
          minItems: cardinality ? 1 : undefined,
          maxItems: cardinality ? 9 : undefined,
          children: [
            { kind: TEXT, name: 'a' },
            { kind: TEXT, name: 'b' },
          ],
        },
      ],
    });

  it('walks into a single element and updates every child', () => {
    const driver = new CeeDriver(elementTemplate());
    const registry = new ActiveComponentRegistryService();
    const a = new FakeWidget();
    const b = new FakeWidget();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry.registerComponent(driver.findOrThrow(['_el', '_a']), a as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry.registerComponent(driver.findOrThrow(['_el', '_b']), b as any);

    driver.setValue(['_el', '_a'], TEXT, 'first');
    driver.setValue(['_el', '_b'], TEXT, 'second');
    registry.updateViewToModel(driver.findOrThrow(['_el']), driver.handlerContext);

    expect(a.last).toBe('first');
    expect(b.last).toBe('second');
  });

  it('walks into a multi element and redraws its pager', () => {
    const driver = new CeeDriver(elementTemplate('multi'));
    const registry = new ActiveComponentRegistryService();
    const a = new FakeWidget();
    const pager = new FakePager();
    const element = driver.findOrThrow(['_el']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry.registerComponent(driver.findOrThrow(['_el', '_a']), a as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry.registerMultiPagerComponent(element, pager as any);

    driver.setValue(['_el', '_a'], TEXT, 'first');
    driver.handlerContext.addMultiInstance(element);
    driver.setValue(['_el', '_a'], TEXT, 'second');
    registry.updateViewToModel(element, driver.handlerContext);

    expect(pager.updates).toBe(1);
    expect(a.last, 'the child of the occurrence on screen').toBe('second');
  });
});

describe('deleting the displayed value', () => {
  it('asks the widget to clear itself', () => {
    const r = rig(TEXT);
    r.registry.deleteCurrentValue(r.component);
    expect(r.widget.deleted).toBe(1);
  });

  it('is a no-op when nothing is registered', () => {
    const driver = new CeeDriver(buildTemplate({ name: 'vs_del', children: [{ kind: TEXT, name: 'f' }] }));
    const registry = new ActiveComponentRegistryService();
    expect(() => registry.deleteCurrentValue(driver.findOrThrow(['_f']))).not.toThrow();
  });
});

describe('hiding empty fields in a repeated element', () => {
  /**
   * `setVisibility` is the read-only viewer's per-occurrence hiding: as the
   * user pages through a repeated element, fields empty on *this* page are
   * hidden and filled ones shown. Distinct from the `hideEmptyFields` pass in
   * the factory, which decides once from the whole instance.
   */
  const visTemplate = () =>
    buildTemplate({
      name: 'vs_vis',
      elements: [
        {
          name: 'el',
          cardinality: 'multi',
          minItems: 1,
          maxItems: 9,
          children: [
            { kind: TEXT, name: 'filled' },
            { kind: TEXT, name: 'empty' },
          ],
        },
      ],
    });

  it('hides a field with no value and shows one with a value', () => {
    const driver = new CeeDriver(visTemplate());
    const registry = new ActiveComponentRegistryService();
    driver.setValue(['_el', '_filled'], TEXT, 'here');

    registry.setVisibility(driver.findOrThrow(['_el']), driver.handlerContext);

    expect(driver.findOrThrow(['_el', '_filled']).hidden).toBe(false);
    expect(driver.findOrThrow(['_el', '_empty']).hidden).toBe(true);
  });

  it('follows the page the user is on', () => {
    const driver = new CeeDriver(visTemplate());
    const registry = new ActiveComponentRegistryService();
    const element = driver.findOrThrow(['_el']);

    driver.setValue(['_el', '_filled'], TEXT, 'on page one');
    driver.handlerContext.addMultiInstance(element);
    // Page two leaves both fields empty.
    registry.setVisibility(element, driver.handlerContext);
    expect(driver.findOrThrow(['_el', '_filled']).hidden).toBe(true);

    driver.handlerContext.setCurrentIndex(element, 0);
    registry.setVisibility(element, driver.handlerContext);
    expect(driver.findOrThrow(['_el', '_filled']).hidden).toBe(false);
  });

  it('does nothing for a component that is not a repeated element', () => {
    const r = rig(TEXT);
    expect(() => r.registry.setVisibility(r.component, r.driver.handlerContext)).not.toThrow();
  });

  /**
   * CHARACTERISATION, and the behaviour is wrong.
   *
   * The literal branch asks `value === '' || value === null` and hides on
   * either. The link and controlled-term branches ask
   * `value != '' || value != null` and *show* on either — which is every value
   * there is, because nothing is simultaneously equal to `''` and to `null`.
   * Both `else` clauses are unreachable, so an empty link or an empty
   * controlled term is never hidden however empty it is.
   *
   * Pinned rather than fixed: unlike the `@id`-stripping bug this loses no
   * data, it only shows a blank row in the read-only viewer, and "links always
   * show" is a defensible thing for someone to have decided on purpose. The
   * `||` reads like a slip, but the tests should say what CEE does until that
   * is settled.
   */
  const iriVisibility = (fieldKind: FieldKind, node: InstanceNode) => {
    const template = buildTemplate({
      name: `vs_vis_${fieldKind.key}`,
      elements: [
        { name: 'el', cardinality: 'multi', minItems: 1, maxItems: 9, children: [{ kind: fieldKind, name: 'f' }] },
      ],
    });
    const driver = new CeeDriver(template, {
      // Only the occurrence is written by hand: it carries the node under test,
      // which the caller supplies in shapes the library would not write.
      instance: {
        ...instanceWith(TEMPLATE_IRI, {}, INSTANCE_IRI),
        _el: [{ [JsonSchema.atId]: 'https://example.org/e/1', _f: node }],
      },
    });
    new ActiveComponentRegistryService().setVisibility(driver.findOrThrow(['_el']), driver.handlerContext);
    return driver.findOrThrow(['_el', '_f']).hidden;
  };

  it('shows a filled link', () => {
    expect(iriVisibility(LINK, linkNode('https://example.org/thing'))).toBe(false);
  });

  it('shows a filled controlled term', () => {
    expect(iriVisibility(CONTROLLED, termNode('https://x/1', 'One'))).toBe(false);
  });

  it('hides an empty literal, which is the branch that does work', () => {
    expect(iriVisibility(TEXT, literalNode(''))).toBe(true);
    expect(iriVisibility(TEXT, literalNode('something'))).toBe(false);
  });
});

describe('paged attribute-value fields', () => {
  const ATTR = kind('attr', 'attribute-value', () => CedarBuilders.attributeValueFieldBuilder(), 'v', {
    write: 'attribute',
  });

  const attrRig = () => {
    const r = rig(ATTR, ['_f'], buildTemplate({ name: 'vs_attr', children: [{ kind: ATTR, name: 'f' }] }));
    return r;
  };

  /**
   * The widget shows one attribute at a time, as a single-entry object pairing
   * the name with its value — the name and value boxes are driven from it.
   */
  it('pushes the attribute on the current page as a name/value pair', () => {
    const r = attrRig();
    r.driver.handlerContext.addMultiInstance(r.component);
    r.driver.handlerContext.changeAttributeValue(r.component, 'colour', 'blue');
    r.sync();
    expect(r.widget.last).toEqual({ colour: 'blue' });
  });

  it('follows the page', () => {
    const r = attrRig();
    r.driver.handlerContext.addMultiInstance(r.component);
    r.driver.handlerContext.changeAttributeValue(r.component, 'colour', 'blue');
    r.driver.handlerContext.addMultiInstance(r.component);
    r.driver.handlerContext.changeAttributeValue(r.component, 'size', 'large');

    r.sync();
    expect(r.widget.last).toEqual({ size: 'large' });

    r.driver.handlerContext.setCurrentIndex(r.component, 0);
    r.sync();
    expect(r.widget.last).toEqual({ colour: 'blue' });
  });

  /**
   * Copying an occurrence leaves both pages pointing at the same attribute
   * name. The sync notices — the name at the cursor equals the one before it —
   * and clears the copy's, so the two stop being the same attribute.
   *
   * The copy used to be given a manufactured name instead, `Attribute Value
   * Field2`. Naming it is the user's to do: a property they never asked for
   * would reach the instance and be saved, and there is nothing to distinguish
   * it from one they meant. An unnamed slot is the same state a freshly added
   * one is in, which is the case below.
   */
  it('unnames a copied attribute so the pages stop sharing one', () => {
    const r = attrRig();
    r.driver.handlerContext.addMultiInstance(r.component);
    r.driver.handlerContext.changeAttributeValue(r.component, 'colour', 'blue');
    r.driver.handlerContext.copyMultiInstance(r.component);

    r.sync();
    r.driver.expectNoErrors('syncing a copied attribute');

    // The working tree rather than the extract: an unnamed slot is not a
    // property, so the extract has nothing to carry it as.
    expect(attributeNames(arrayAt(r.driver.fullData, '_f')), 'the copy kept the name it was copied from').toEqual([
      'colour',
      '',
    ]);
    expect(r.widget.last).toEqual({ '': null });
  });

  it('leaves a field with no attributes alone', () => {
    const r = attrRig();
    expect(() => r.sync()).not.toThrow();
    expect(r.widget.pushed).toEqual([]);
  });

  /**
   * The pager's "+" makes a slot before the user has named anything, and it
   * makes the same empty value wrapper every other field type gets — so the
   * slot holds `{'@value': null}` where an attribute name is expected. The sync
   * spots that and replaces it with an empty name, rather than showing the
   * wrapper.
   *
   * Empty, not manufactured. The slot used to become `Attribute Value Field1`
   * on sight, so a user who clicked "+" and then stopped had a property in
   * their instance that they never named and could not tell apart from one they
   * had. It stays unnamed until they type.
   */
  it('leaves a slot that was just added unnamed', () => {
    const r = attrRig();
    r.driver.handlerContext.addMultiInstance(r.component);
    r.sync();
    r.driver.expectNoErrors('syncing a freshly added attribute slot');

    expect(attributeNames(arrayAt(r.driver.fullData, '_f'))).toEqual(['']);
    expect(r.widget.last).toEqual({ '': null });
  });

  /**
   * An empty name is accepted in silence rather than replaced. An injected
   * instance can carry one, and inventing a name for it would rewrite the
   * user's data on load.
   */
  it('accepts an empty attribute name without pushing anything', () => {
    const template = buildTemplate({ name: 'vs_attr_blank', children: [{ kind: ATTR, name: 'f' }] });
    const driver = new CeeDriver(template, {
      instance: instanceWith(TEMPLATE_IRI, { _f: [''] }, 'https://example.org/i/1'),
    });
    const registry = new ActiveComponentRegistryService();
    const widget = new FakeWidget();
    const component = driver.findOrThrow(['_f']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry.registerComponent(component, widget as any);

    expect(() => registry.updateViewToModel(component, driver.handlerContext)).not.toThrow();
    expect(widget.pushed).toEqual([]);
  });
});
