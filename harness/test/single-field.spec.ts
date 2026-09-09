/**
 * The `cedar-embeddable-field` element's domain half: a field artifact on its own, and
 * the value that goes in and out of it.
 *
 * Both pieces are Angular-free, which is why they are tested here rather than beside
 * the component that uses them. `templateForField` is the wrapping that lets CEE build
 * a component tree from an artifact that is not a template, and `cedar-field-value` is
 * the translation between what a widget writes into an instance and what a host reads
 * back. Between them they are everything the element does apart from rendering.
 *
 * Swept over every field kind rather than sampled, for the reason the rest of this
 * harness is: an enumeration of the decision space has coverage you can point at. A
 * new input type joins `FIELD_KINDS` and is swept here the same day.
 */
import { describe, expect, it } from 'vitest';
import { CedarWriters, JsonNode } from 'cedar-model-typescript-library';
import { FIELD_KINDS, FieldKind } from '../src/axes';
import { buildField, ChildSpec } from '../src/generate';
import { RecordingMessageHandler } from '../src/driver';
import { DataContext } from '@cee/util/data-context';
import { HandlerContext } from '@cee/util/handler-context';
import { CedarComponent } from '@cee/models/component/cedar-component.model';
import { FieldComponent } from '@cee/models/component/field-component.model';
import { decideFieldWidget } from '@cee/components/cedar-component-renderer/component-render-decision';
import { SINGLE_FIELD_PROPERTY, templateForField } from '@cee/util/single-field-template';
import { readFieldValue, sameFieldValue, writeFieldValue } from '@cee/util/cedar-field-value';
import type { CedarEmbeddableFieldValue } from '../../src/app/cee-public-api';

/** The three choice kinds need options before a choice among them means anything. */
const OPTIONS = [{ label: 'Option A' }, { label: 'Option B' }];

const optionBearing = (kind: FieldKind): boolean =>
  kind.key === 'radio' || kind.key === 'checkbox' || kind.key === 'listSingle' || kind.key === 'listMulti';

const fieldArtifact = (kind: FieldKind, extra: Partial<ChildSpec> = {}): JsonNode => {
  const spec: ChildSpec = {
    kind,
    name: kind.key,
    ...(optionBearing(kind) ? { options: OPTIONS } : {}),
    ...extra,
  };
  const field = buildField(spec);
  const written = CedarWriters.json().getStrict().getFieldWriterForField(field).getAsJsonNode(field);
  // Round through JSON, so what the element receives is the plain object a host holds.
  return JSON.parse(JSON.stringify(written)) as JsonNode;
};

/** What the element does with a field before anything is rendered from it. */
const mount = (artifact: JsonNode, readOnlyMode = false) => {
  const messages = new RecordingMessageHandler();
  const dataContext = new DataContext();
  const handlerContext = new HandlerContext(dataContext, messages);
  if (readOnlyMode) {
    handlerContext.enableReadOnlyMode();
  }
  dataContext.setInputTemplate(templateForField(artifact), handlerContext, null);
  const children = dataContext.templateRepresentation?.children ?? [];
  return { messages, dataContext, handlerContext, children };
};

/**
 * The input type the widget would route this component to, or null if it would route
 * nothing. Asked through the routing itself rather than by reaching into the component,
 * so the assertion is about what will actually be drawn.
 */
const inputTypeOf = (component: CedarComponent): string | null => {
  const decision = decideFieldWidget(component);
  return decision.kind === 'none' ? null : decision.component.basicInfo.inputType;
};

/** The one component, narrowed to the kind that holds a value. */
const valuedField = (children: readonly CedarComponent[]): FieldComponent => {
  const decision = decideFieldWidget(children[0]);
  if (decision.kind !== 'field') {
    throw new Error(`expected a field holding a value, and the widget routes this as "${decision.kind}"`);
  }
  return decision.component;
};

/** A value of the kind this field takes, for the round trip. */
const sampleValue = (kind: FieldKind): CedarEmbeddableFieldValue | null => {
  switch (kind.key) {
    case 'numeric':
      return { kind: 'number', value: 42 };
    case 'temporal':
      return { kind: 'temporal', value: '2026-08-01' };
    case 'controlled':
      return { kind: 'iri', iri: 'http://purl.bioontology.org/ontology/MESH/D006801', label: 'Humans' };
    case 'link':
    case 'orcid':
    case 'ror':
    case 'pfas':
    case 'pubmed':
    case 'rrid':
    case 'nihGrant':
    case 'doi':
      return { kind: 'iri', iri: kind.sample, label: null };
    case 'checkbox':
    case 'listMulti':
      return { kind: 'literals', values: ['Option A'] };
    case 'radio':
    case 'listSingle':
      return { kind: 'literal', value: 'Option A' };
    case 'attrValue':
      return null;
    default:
      return kind.isStatic ? null : { kind: 'literal', value: kind.sample };
  }
};

describe('a field artifact, wrapped in the smallest template that holds it', () => {
  it.each(FIELD_KINDS.map((kind) => [kind.key, kind] as const))('renders %s as one component', (_key, kind) => {
    const { messages, children } = mount(fieldArtifact(kind));

    expect(messages.errors).toEqual([]);
    expect(children).toHaveLength(1);
    expect(inputTypeOf(children[0])).toBe(kind.inputType);
  });

  /**
   * The property name does not come from the field.
   *
   * A host hands over the field it is designing, whose name may be empty, may repeat
   * another field's, or may not be usable as a key at all. None of that can be allowed
   * to decide where the value lands, so the wrapping names the slot itself.
   */
  it('deploys every field under the same property, whatever the field is called', () => {
    const named = mount(fieldArtifact(FIELD_KINDS[0]));
    expect(valuedField(named.children).path).toEqual([SINGLE_FIELD_PROPERTY]);
  });

  /**
   * Requiredness and cardinality are deployment facts, and this deployment states
   * neither. That is what makes the element usable for a default value: one that is
   * absent is not an error, and one that is present is a single value.
   */
  it.each(FIELD_KINDS.filter((kind) => !kind.isStatic).map((kind) => [kind.key, kind] as const))(
    'leaves %s neither required nor repeated',
    (_key, kind) => {
      const { children } = mount(fieldArtifact(kind));
      const field = valuedField(children);

      expect(field.valueInfo.requiredValue).toBe(false);
      // Only the kinds that are multiple by their own definition may page.
      expect(field.isMultiPage()).toBe(kind.key === 'attrValue');
    },
  );
});

describe('a value written into a lone field and read back out', () => {
  it.each(
    FIELD_KINDS.filter((kind) => sampleValue(kind) !== null).map(
      (kind) => [kind.key, kind, sampleValue(kind) as CedarEmbeddableFieldValue] as const,
    ),
  )('round-trips through %s', (_key, kind, value) => {
    const { messages, children, handlerContext } = mount(fieldArtifact(kind));
    const field = valuedField(children);

    expect(writeFieldValue(value, field, handlerContext)).toBeNull();
    expect(readFieldValue(field, handlerContext)).toEqual(value);
    expect(messages.errors).toEqual([]);
  });

  it('reports nothing for a field nobody has filled in', () => {
    const { children, handlerContext } = mount(fieldArtifact(FIELD_KINDS[0]));
    expect(readFieldValue(valuedField(children), handlerContext)).toEqual({ kind: 'none' });
  });

  /**
   * A field carrying its own default starts out holding it, which is what lets a host
   * hand back the field it read and see the value it wrote.
   */
  it('starts out holding the default the field declares', () => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'text') as FieldKind;
    const { children, handlerContext } = mount(fieldArtifact(kind, { defaultValue: 'declared' }));

    expect(readFieldValue(valuedField(children), handlerContext)).toEqual({
      kind: 'literal',
      value: 'declared',
    });
  });

  it('clears the field when the host supplies nothing', () => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'text') as FieldKind;
    const { children, handlerContext } = mount(fieldArtifact(kind, { defaultValue: 'declared' }));
    const field = valuedField(children);

    expect(writeFieldValue({ kind: 'none' }, field, handlerContext)).toBeNull();
    expect(readFieldValue(field, handlerContext)).toEqual({ kind: 'none' });
  });

  /**
   * A number field holding something that is not a number reports nothing rather than
   * a `NaN`. `1e` on the way to `1e6` is the state this is about, and the change
   * detail's `valid` is what separates it from an empty field.
   */
  it('reports nothing for a numeric field holding text', () => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'numeric') as FieldKind;
    const { children, handlerContext } = mount(fieldArtifact(kind));
    const field = valuedField(children);

    handlerContext.changeValue(field, '1e');

    expect(readFieldValue(field, handlerContext)).toEqual({ kind: 'none' });
  });
});

describe('a value of the wrong kind', () => {
  it('is refused with the kind the field takes', () => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'numeric') as FieldKind;
    const { children, handlerContext } = mount(fieldArtifact(kind));

    const refusal = writeFieldValue({ kind: 'literal', value: 'x' }, valuedField(children), handlerContext);

    expect(refusal).toContain('"number"');
    expect(readFieldValue(valuedField(children), handlerContext)).toEqual({ kind: 'none' });
  });

  it('is refused for an attribute-value field, which names its own slots', () => {
    const kind = FIELD_KINDS.find((candidate) => candidate.key === 'attrValue') as FieldKind;
    const { children, handlerContext } = mount(fieldArtifact(kind));

    const refusal = writeFieldValue({ kind: 'literal', value: 'x' }, valuedField(children), handlerContext);

    expect(refusal).toContain('attribute-value');
  });
});

/**
 * The paths a host reaches by handing over the wrong shape, and the two field kinds
 * whose value is not one literal.
 *
 * Each refusal names the kind the field does take, because a host that sent the wrong
 * one is going to send another, and "ignored" on its own does not say what to send.
 */
describe('the shapes a field will and will not take', () => {
  const kindNamed = (key: string): FieldKind => FIELD_KINDS.find((candidate) => candidate.key === key) as FieldKind;

  const mounted = (key: string) => {
    const { children, handlerContext, messages } = mount(fieldArtifact(kindNamed(key)));
    return { field: valuedField(children), handlerContext, messages };
  };

  it('reads the named slots an attribute-value field holds', () => {
    const { field, handlerContext } = mounted('attrValue');

    // A slot before a name for it: the widget's add control does this, and an
    // attribute-value field starts with no occurrence to name.
    handlerContext.addMultiInstance(field);
    handlerContext.changeAttributeValue(field, 'instrument', 'mass spectrometer');

    expect(readFieldValue(field, handlerContext)).toEqual({
      kind: 'attributes',
      values: { instrument: 'mass spectrometer' },
    });
  });

  it('reads nothing from an attribute-value field with no slot named', () => {
    const { field, handlerContext } = mounted('attrValue');
    expect(readFieldValue(field, handlerContext)).toEqual({ kind: 'none' });
  });

  it('accepts nothing for an attribute-value field, which is what it holds already', () => {
    const { field, handlerContext } = mounted('attrValue');
    expect(writeFieldValue({ kind: 'none' }, field, handlerContext)).toBeNull();
  });

  it('refuses a set of attributes for a field that is not one', () => {
    const { field, handlerContext } = mounted('text');
    expect(writeFieldValue({ kind: 'attributes', values: { a: 'b' } }, field, handlerContext)).toContain('"literal"');
  });

  it.each([
    ['checkbox', 'clears a checkbox group'],
    ['listMulti', 'clears a multi-select list'],
  ])('%s: %s', (key) => {
    const { field, handlerContext } = mounted(key);

    expect(writeFieldValue({ kind: 'literals', values: ['Option A'] }, field, handlerContext)).toBeNull();
    expect(writeFieldValue({ kind: 'none' }, field, handlerContext)).toBeNull();
    expect(readFieldValue(field, handlerContext)).toEqual({ kind: 'none' });
  });

  it('clears a controlled term', () => {
    const { field, handlerContext } = mounted('controlled');

    expect(
      writeFieldValue({ kind: 'iri', iri: 'http://example.org/t', label: 'T' }, field, handlerContext),
    ).toBeNull();
    expect(writeFieldValue({ kind: 'none' }, field, handlerContext)).toBeNull();
    expect(readFieldValue(field, handlerContext)).toEqual({ kind: 'none' });
  });

  it('clears a link', () => {
    const { field, handlerContext } = mounted('link');

    expect(writeFieldValue({ kind: 'iri', iri: 'https://example.org/x', label: null }, field, handlerContext)).toBeNull();
    expect(writeFieldValue({ kind: 'none' }, field, handlerContext)).toBeNull();
    expect(readFieldValue(field, handlerContext)).toEqual({ kind: 'none' });
  });

  it.each([
    ['checkbox', { kind: 'literal', value: 'Option A' } as CedarEmbeddableFieldValue, '"literals"'],
    ['controlled', { kind: 'literal', value: 'Humans' } as CedarEmbeddableFieldValue, '"iri"'],
    ['link', { kind: 'literal', value: 'https://example.org' } as CedarEmbeddableFieldValue, '"iri"'],
    ['numeric', { kind: 'temporal', value: '2026-08-01' } as CedarEmbeddableFieldValue, '"number"'],
    ['temporal', { kind: 'literal', value: '2026-08-01' } as CedarEmbeddableFieldValue, '"temporal"'],
    ['text', { kind: 'number', value: 3 } as CedarEmbeddableFieldValue, '"literal"'],
    ['text', { kind: 'temporal', value: '2026-08-01' } as CedarEmbeddableFieldValue, '"literal"'],
    ['text', { kind: 'iri', iri: 'https://example.org', label: null } as CedarEmbeddableFieldValue, '"literal"'],
    ['text', { kind: 'literals', values: ['a'] } as CedarEmbeddableFieldValue, '"literal"'],
  ])('refuses a %s field a value it cannot hold', (key, value, expected) => {
    const { field, handlerContext } = mounted(key);

    const refusal = writeFieldValue(value, field, handlerContext);

    expect(refusal).toContain(expected);
    expect(readFieldValue(field, handlerContext)).toEqual({ kind: 'none' });
  });
});

/**
 * When two values count as the same, which is what decides whether the element
 * announces a change.
 *
 * It is a switch over the union rather than a comparison of two serializations, so it
 * is worth stating what each member means by equal — above all the two that hold more
 * than one thing.
 */
describe('two values, the same or not', () => {
  it.each([
    [{ kind: 'none' } as CedarEmbeddableFieldValue, { kind: 'none' } as CedarEmbeddableFieldValue, true],
    [
      { kind: 'literal', value: 'a' } as CedarEmbeddableFieldValue,
      { kind: 'literal', value: 'a' } as CedarEmbeddableFieldValue,
      true,
    ],
    [
      { kind: 'literal', value: 'a' } as CedarEmbeddableFieldValue,
      { kind: 'literal', value: 'b' } as CedarEmbeddableFieldValue,
      false,
    ],
    [
      { kind: 'number', value: 1 } as CedarEmbeddableFieldValue,
      { kind: 'literal', value: '1' } as CedarEmbeddableFieldValue,
      false,
    ],
    [
      { kind: 'number', value: 1 } as CedarEmbeddableFieldValue,
      { kind: 'number', value: 1 } as CedarEmbeddableFieldValue,
      true,
    ],
    [
      { kind: 'temporal', value: '2026-08-01' } as CedarEmbeddableFieldValue,
      { kind: 'temporal', value: '2026-08-02' } as CedarEmbeddableFieldValue,
      false,
    ],
    [
      { kind: 'iri', iri: 'http://x', label: 'X' } as CedarEmbeddableFieldValue,
      { kind: 'iri', iri: 'http://x', label: 'X' } as CedarEmbeddableFieldValue,
      true,
    ],
    // The same term relabelled is a different value: the label is stored beside the IRI.
    [
      { kind: 'iri', iri: 'http://x', label: 'X' } as CedarEmbeddableFieldValue,
      { kind: 'iri', iri: 'http://x', label: 'Y' } as CedarEmbeddableFieldValue,
      false,
    ],
    [
      { kind: 'literals', values: ['a', 'b'] } as CedarEmbeddableFieldValue,
      { kind: 'literals', values: ['a', 'b'] } as CedarEmbeddableFieldValue,
      true,
    ],
    // Order is what the widget shows, so a reordered set is a change.
    [
      { kind: 'literals', values: ['a', 'b'] } as CedarEmbeddableFieldValue,
      { kind: 'literals', values: ['b', 'a'] } as CedarEmbeddableFieldValue,
      false,
    ],
    [
      { kind: 'literals', values: ['a'] } as CedarEmbeddableFieldValue,
      { kind: 'literals', values: ['a', 'b'] } as CedarEmbeddableFieldValue,
      false,
    ],
    // Slots are named, so their order is not part of what the field holds.
    [
      { kind: 'attributes', values: { a: '1', b: '2' } } as CedarEmbeddableFieldValue,
      { kind: 'attributes', values: { b: '2', a: '1' } } as CedarEmbeddableFieldValue,
      true,
    ],
    [
      { kind: 'attributes', values: { a: '1' } } as CedarEmbeddableFieldValue,
      { kind: 'attributes', values: { a: '2' } } as CedarEmbeddableFieldValue,
      false,
    ],
    [
      { kind: 'attributes', values: { a: '1' } } as CedarEmbeddableFieldValue,
      { kind: 'attributes', values: { a: '1', b: '2' } } as CedarEmbeddableFieldValue,
      false,
    ],
    // A slot renamed keeps the count and changes the field.
    [
      { kind: 'attributes', values: { a: '1' } } as CedarEmbeddableFieldValue,
      { kind: 'attributes', values: { b: '1' } } as CedarEmbeddableFieldValue,
      false,
    ],
  ])('%o and %o', (left, right, expected) => {
    expect(sameFieldValue(left, right)).toBe(expected);
    expect(sameFieldValue(right, left)).toBe(expected);
  });
});
