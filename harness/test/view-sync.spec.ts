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
import { DocumentKey } from '../src/document-keys';
import {
  CedarBuilders,
  ControlledTermOntologyBuilder,
  Iri,
  NumberType,
  TemporalGranularity,
  TemporalType,
} from 'cedar-model-typescript-library';
import { ActiveComponentRegistryService } from '@cee/service/active-component-registry.service';
import type { InstanceNode } from '@cee/models/instance-node.model';
import { FieldKind } from '../src/axes';
import { buildTemplate } from '../src/generate';
import { CeeDriver } from '../src/driver';
import {
  containerValue,
  instanceWith,
  linkNode,
  linkValue,
  listValue,
  literalNode,
  literalValue,
  termNode,
  termValue,
  templateIdOf,
} from '../src/values';
import { arrayAt } from '../src/nodes';
import { InstanceDataAttributeValueFieldName } from 'cedar-model-typescript-library';

/** The names an attribute-value field is holding, in page order. */
const attributeNames = (slots: unknown[]): (string | null)[] =>
  slots.map((slot) => (slot instanceof InstanceDataAttributeValueFieldName ? slot.name : null));

/**
 * An instance always names the template it is an instance of; there is no
 * valid CEDAR instance without one. Fixtures that stand in for what a host page
 * injects have to be valid instances too.
 */
const INSTANCE_IRI = 'https://example.org/i/1';

const kind = (
  key: string,
  inputType: string,
  make: () => unknown,
  sample: string,
  extra: Partial<FieldKind> = {},
): FieldKind => ({ key, inputType, make, isStatic: false, write: 'value', sample, ...extra }) as FieldKind;

const TEXT = kind('text', 'textfield', () => CedarBuilders.textFieldBuilder(), 'some text');
const NUMERIC = kind('numeric', 'numeric', () => CedarBuilders.numericFieldBuilder(), '42.5', {
  configure: (b: any) => b.withNumberType(NumberType.DECIMAL),
});
const TEMPORAL = kind('temporal', 'temporal', () => CedarBuilders.temporalFieldBuilder(), '2026-08-20', {
  configure: (b: any) => b.withTemporalType(TemporalType.DATE).withTemporalGranularity(TemporalGranularity.DAY),
});
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

  it.each([
    ['numeric', NUMERIC, 42.5, '42.5'],
    ['temporal', TEMPORAL, '2026-08-20', '2026-08-20'],
  ] as const)('pushes a seeded %s default into an editable widget', (_name, fieldKind, declared, shown) => {
    const template = buildTemplate({
      name: `vs_edit_${_name}_default`,
      children: [{ kind: fieldKind, name: 'f', defaultValue: declared }],
    });
    const r = rig(fieldKind, ['_f'], template);

    r.sync();

    expect(r.widget.last).toBe(shown);
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
  it('pushes both halves of a controlled term when editable', () => {
    const r = rig(CONTROLLED);
    r.driver.handlerContext.changeControlledValue(r.component, 'https://example.org/terms/human', 'Homo sapiens');
    r.sync();
    expect(r.widget.last).toEqual({ iri: 'https://example.org/terms/human', label: 'Homo sapiens' });
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

  it('clears a seeded literal default from a specification-only read-only control', () => {
    const template = buildTemplate({
      name: 'vs_ro_literal_default',
      children: [{ kind: TEXT, name: 'f', defaultValue: 'Draft record' }],
    });
    const r = rig(TEXT, ['_f'], template, { readOnlyMode: true });

    r.sync();

    expect(r.widget.last).toBeNull();
  });

  it('clears a seeded term default from a specification-only read-only control', () => {
    const template = buildTemplate({
      name: 'vs_ro_term_default',
      children: [
        {
          kind: CONTROLLED,
          name: 'f',
          defaultValue: { iri: 'https://example.org/terms/human', label: 'Homo sapiens' },
        },
      ],
    });
    const r = rig(CONTROLLED, ['_f'], template, { readOnlyMode: true });

    r.sync();

    expect(r.widget.last).toBeNull();
  });

  it.each([
    ['numeric', NUMERIC, 42.5],
    ['temporal', TEMPORAL, '2026-08-20'],
  ] as const)('clears a seeded %s default from a specification-only read-only control', (_name, fieldKind, declared) => {
    const template = buildTemplate({
      name: `vs_ro_${_name}_default`,
      children: [{ kind: fieldKind, name: 'f', defaultValue: declared }],
    });
    const r = rig(fieldKind, ['_f'], template, { readOnlyMode: true });

    r.sync();

    expect(r.widget.last).toBeNull();
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

  it('pushes both halves of a paged controlled term', () => {
    const r = rig(CONTROLLED, ['_f'], pagedTemplate(CONTROLLED));
    r.driver.handlerContext.changeControlledValue(r.component, 'https://example.org/terms/human', 'Homo sapiens');
    r.sync();
    expect(r.widget.last).toEqual({ iri: 'https://example.org/terms/human', label: 'Homo sapiens' });
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

  it('clears a child omitted from the next multi-element occurrence', () => {
    const template = elementTemplate('multi');
    const driver = new CeeDriver(template, {
      instance: instanceWith(
        templateIdOf(template),
        {
          _el: listValue(
            containerValue({ _a: literalValue('first occurrence') }),
            containerValue({ _b: literalValue('second occurrence') }),
          ),
        },
        INSTANCE_IRI,
      ),
    });
    const registry = new ActiveComponentRegistryService();
    const widget = new FakeWidget();
    const element = driver.findOrThrow(['_el']);
    const child = driver.findOrThrow(['_el', '_a']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry.registerComponent(child, widget as any);

    registry.updateViewToModel(element, driver.handlerContext);
    expect(widget.last).toBe('first occurrence');

    driver.handlerContext.setCurrentIndex(element, 1);
    registry.updateViewToModel(element, driver.handlerContext);
    expect(widget.last).toBeNull();
  });

  /**
   * The model-to-widget contract, across every value shape that has a distinct
   * branch in ActiveComponentRegistryService. Each row exercises both sides of
   * an occurrence boundary: a populated first occurrence and an omitted child
   * in the second. The same matrix runs editable and read-only with an actual
   * supplied instance; read-only must display recorded data, not treat it as a
   * template default or leave the previous occurrence on screen.
   */
  const syncCases = [
    ['text', TEXT, literalValue('alpha'), 'alpha', null],
    ['numeric', NUMERIC, literalValue('42.5'), '42.5', null],
    ['temporal', TEMPORAL, literalValue('2026-08-20'), '2026-08-20', null],
    ['link', LINK, linkValue('https://example.org/thing'), 'https://example.org/thing', null],
    [
      'external authority',
      ORCID,
      termValue('https://orcid.org/0000-0002-1825-0097', 'Ada Lovelace'),
      { iri: 'https://orcid.org/0000-0002-1825-0097', label: 'Ada Lovelace' },
      null,
    ],
    [
      'controlled term',
      CONTROLLED,
      termValue('https://example.org/terms/human', 'Homo sapiens'),
      { iri: 'https://example.org/terms/human', label: 'Homo sapiens' },
      null,
    ],
    [
      'checkbox',
      CHECKBOX,
      listValue(literalValue('Option A'), literalValue('Option B')),
      ['Option A', 'Option B'],
      [],
    ],
  ] as const;

  it.each(
    syncCases.flatMap(([name, fieldKind, value, shown, cleared]) =>
      [false, true].map((readOnlyMode) => [name, readOnlyMode, fieldKind, value, shown, cleared] as const),
    ),
  )('syncs %s across nested occurrences (readOnly=%s)', (_name, readOnlyMode, fieldKind, value, shown, cleared) => {
    const template = buildTemplate({
      name: `vs_matrix_${fieldKind.key}_${readOnlyMode ? 'readonly' : 'editable'}`,
      elements: [
        {
          name: 'el',
          cardinality: 'multi',
          minItems: 1,
          maxItems: 3,
          children: [{ kind: fieldKind, name: 'f' }],
        },
      ],
    });
    const driver = new CeeDriver(template, {
      readOnlyMode,
      instance: instanceWith(
        templateIdOf(template),
        { _el: listValue(containerValue({ _f: value }), containerValue({})) },
        INSTANCE_IRI,
      ),
    });
    const registry = new ActiveComponentRegistryService();
    const widget = new FakeWidget();
    const element = driver.findOrThrow(['_el']);
    const field = driver.findOrThrow(['_el', '_f']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry.registerComponent(field, widget as any);

    registry.updateViewToModel(element, driver.handlerContext);
    expect(widget.last).toEqual(shown);

    driver.handlerContext.setCurrentIndex(element, 1);
    registry.updateViewToModel(element, driver.handlerContext);
    expect(widget.last).toEqual(cleared);
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

  it('clears the preceding attribute when paging to an unnamed occurrence', () => {
    // First sync the new slot so the model normalises it to the accepted empty
    // name, then cross the boundary twice. Returning early for that empty name
    // left the named occurrence in the reused widget on the second crossing.
    const r = attrRig();
    r.driver.handlerContext.addMultiInstance(r.component);
    r.driver.handlerContext.changeAttributeValue(r.component, 'colour', 'blue');
    r.driver.handlerContext.addMultiInstance(r.component);
    r.sync();
    expect(r.widget.last).toEqual({ '': null });

    r.driver.handlerContext.setCurrentIndex(r.component, 0);
    r.sync();
    expect(r.widget.last).toEqual({ colour: 'blue' });

    r.driver.handlerContext.setCurrentIndex(r.component, 1);
    r.sync();
    expect(r.widget.last).toEqual({ '': null });
  });

  it('copies an attribute under a unique derived name', () => {
    const r = attrRig();
    r.driver.handlerContext.addMultiInstance(r.component);
    r.driver.handlerContext.changeAttributeValue(r.component, 'colour', 'blue');
    r.driver.handlerContext.copyMultiInstance(r.component);

    r.sync();
    r.driver.expectNoErrors('syncing a copied attribute');

    expect(attributeNames(arrayAt(r.driver.fullData, '_f'))).toEqual(['colour', 'colour copy']);
    expect(r.widget.last).toEqual({ 'colour copy': 'blue' });

    r.driver.handlerContext.setCurrentIndex(r.component, 0);
    r.sync();
    expect(r.widget.last).toEqual({ colour: 'blue' });
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

  /** The model reader drops a raw empty string; the registry must not turn the resulting empty list into a page. */
  it('does not manufacture an attribute for an injected raw empty name', () => {
    const template = buildTemplate({ name: 'vs_attr_blank', children: [{ kind: ATTR, name: 'f' }] });
    // A genuinely injected malformed/draft shape. Passing [''] through
    // `instanceWith` did not create this case: the model writer normalised that
    // unsupported raw string out of the array, so the old assertion exercised
    // an empty list and could pass without reaching the empty-name branch.
    const instance = { ...instanceWith(templateIdOf(template), {}, INSTANCE_IRI), _f: [''] };
    const driver = new CeeDriver(template, {
      instance,
    });
    const registry = new ActiveComponentRegistryService();
    const widget = new FakeWidget();
    const component = driver.findOrThrow(['_f']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry.registerComponent(component, widget as any);

    expect(() => registry.updateViewToModel(component, driver.handlerContext)).not.toThrow();
    expect(attributeNames(arrayAt(driver.fullData, '_f'))).toEqual([]);
    expect(widget.pushed).toEqual([]);
  });
});
