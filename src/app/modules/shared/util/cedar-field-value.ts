import { InstanceDataAttributeValueFieldName } from 'cedar-model-typescript-library';
import { FieldComponent } from '../models/component/field-component.model';
import { MultiFieldComponent } from '../models/field/multi-field-component.model';
import { InputType } from '../models/input-type.model';
import { EXTERNAL_AUTHORITY_INPUT_TYPES } from '../models/ext-auth-categories.model';
import { isInstanceArray, isInstanceObject } from '../models/instance-node.model';
import { HandlerContext } from './handler-context';
import { InstanceValueNode } from './instance-value-node';
import type { CedarEmbeddableFieldValue } from '../../../cee-public-api';

/** Nothing held, which every field can report and several start out holding. */
const NOTHING: CedarEmbeddableFieldValue = { kind: 'none' };

/** Whether this field's value is an IRI rather than a literal. */
function isIriValued(component: FieldComponent): boolean {
  const inputType = component.basicInfo.inputType ?? '';
  return (
    inputType === InputType.controlled ||
    inputType === InputType.link ||
    EXTERNAL_AUTHORITY_INPUT_TYPES.has(inputType as InputType)
  );
}

/**
 * Whether this field holds a list of literals rather than one.
 *
 * The same question `ActiveComponentRegistryService` asks before pushing an array into
 * a widget, and asked the same way: a checkbox group and a multi-select list are
 * multiple by their own definition and are not paged, which is what separates them
 * from a field repeated by its deployment.
 */
function holdsLiteralList(component: FieldComponent): boolean {
  return component instanceof MultiFieldComponent && !component.isMultiPage();
}

/**
 * What a field is holding, in the terms its own type is written in.
 *
 * A union rather than a string, because the distinctions are real ones the model
 * already makes and a host has to make again the moment it writes the value back: a
 * number is a number, a term is an IRI with a label, and a checkbox group holds a set.
 * Flattening all six to text is what leaves a caller parsing its own output.
 *
 * `none` is what an unfilled field reports, and also what a numeric field reports
 * while it holds something that is not a number — `3.` on the way to `3.5`. The
 * widget shows that state as invalid, and `valid` on the change detail carries it, so
 * a host is told the difference between empty and unusable rather than being handed a
 * `NaN` to discover on its own.
 */
export function readFieldValue(component: FieldComponent, handlerContext: HandlerContext): CedarEmbeddableFieldValue {
  const node = handlerContext.getDataObjectNodeByPath(component.path);

  if (component.basicInfo.inputType === InputType.attributeValue) {
    return readAttributes(component, handlerContext);
  }
  if (holdsLiteralList(component)) {
    const entries = isInstanceArray(node) ? node : [];
    const values = entries
      .map((entry) => InstanceValueNode.literal(entry))
      .filter((value): value is string => value !== null && value !== undefined && value !== '');
    return values.length === 0 ? NOTHING : { kind: 'literals', values };
  }
  if (isIriValued(component)) {
    const iri = InstanceValueNode.iri(node);
    if (iri === null || iri === undefined || iri === '') {
      return NOTHING;
    }
    return { kind: 'iri', iri, label: InstanceValueNode.label(node) ?? null };
  }

  const literal = InstanceValueNode.literal(node);
  if (literal === null || literal === undefined || literal === '') {
    return NOTHING;
  }
  if (component.basicInfo.inputType === InputType.numeric) {
    const parsed = Number(literal);
    return literal.trim() !== '' && Number.isFinite(parsed) ? { kind: 'number', value: parsed } : NOTHING;
  }
  if (component.basicInfo.inputType === InputType.temporal) {
    return { kind: 'temporal', value: literal };
  }
  return { kind: 'literal', value: literal };
}

/**
 * The named slots an attribute-value field holds.
 *
 * The names sit at the field's own path as occurrences; each one's value sits beside
 * the field, under that name, in the enclosing object. That is the shape the wire
 * form has and the shape CEE edits, so reading it means visiting both places.
 */
function readAttributes(component: FieldComponent, handlerContext: HandlerContext): CedarEmbeddableFieldValue {
  const slots = handlerContext.getDataObjectNodeByPath(component.path);
  const parent = handlerContext.getParentDataObjectNodeByPath(component.path);
  if (!isInstanceArray(slots) || !isInstanceObject(parent)) {
    return NOTHING;
  }
  const values: Record<string, string | null> = {};
  for (const slot of slots) {
    if (slot instanceof InstanceDataAttributeValueFieldName && slot.name !== '') {
      values[slot.name] = InstanceValueNode.literal(parent.values[slot.name]) ?? null;
    }
  }
  return Object.keys(values).length === 0 ? NOTHING : { kind: 'attributes', values };
}

/**
 * Put a host-supplied value into the field, or say why it cannot go there.
 *
 * Returns null when the value was written, and a sentence naming the mismatch when it
 * was not, so the caller reports one thing rather than every layer inventing its own
 * complaint. A host assigning a term to a number field has made a mistake worth
 * hearing about; discarding it in silence is what the editor's own artifact inputs
 * were changed to stop doing.
 *
 * An attribute-value field takes no value here, and that is a limitation rather than
 * an oversight: its slots are created one at a time by the control that names them,
 * so writing a set of pairs means synthesizing occurrences, and the model carries no
 * default for such a field to make it worth doing.
 */
export function writeFieldValue(
  value: CedarEmbeddableFieldValue,
  component: FieldComponent,
  handlerContext: HandlerContext,
): string | null {
  const inputType = component.basicInfo.inputType ?? 'a field';

  if (inputType === InputType.attributeValue) {
    return value.kind === 'none'
      ? null
      : 'an attribute-value field names its own slots, so "value" cannot be assigned to one.';
  }

  if (value.kind === 'none') {
    if (holdsLiteralList(component)) {
      handlerContext.changeListValue(component, []);
    } else if (isIriValued(component) && inputType === InputType.controlled) {
      handlerContext.changeControlledValue(component, null, null);
    } else {
      handlerContext.changeValue(component, null);
    }
    return null;
  }

  if (holdsLiteralList(component)) {
    return value.kind === 'literals'
      ? (handlerContext.changeListValue(component, [...value.values]), null)
      : refusal(value, inputType, '"literals"');
  }

  if (isIriValued(component)) {
    if (value.kind !== 'iri') {
      return refusal(value, inputType, '"iri"');
    }
    if (inputType === InputType.link) {
      // A link's value is the IRI itself, with no label to keep beside it.
      handlerContext.changeValue(component, value.iri);
    } else {
      handlerContext.changeControlledValue(component, value.iri, value.label);
    }
    return null;
  }

  /*
   * Which of the three literal kinds this field is written in, worked out once. Each
   * branch below refuses with it rather than with its own guess, which is what a
   * temporal value offered to a number field was getting wrong: it was told the field
   * takes a literal, and the field takes a number.
   */
  const literalKind =
    inputType === InputType.numeric ? '"number"' : inputType === InputType.temporal ? '"temporal"' : '"literal"';

  switch (value.kind) {
    case 'literal':
      return literalKind === '"literal"'
        ? (handlerContext.changeValue(component, value.value), null)
        : refusal(value, inputType, literalKind);
    case 'number':
      return inputType === InputType.numeric
        ? (handlerContext.changeValue(component, String(value.value)), null)
        : refusal(value, inputType, literalKind);
    case 'temporal':
      return inputType === InputType.temporal
        ? (handlerContext.changeValue(component, value.value), null)
        : refusal(value, inputType, literalKind);
    default:
      return refusal(value, inputType, literalKind);
  }
}

function refusal(value: CedarEmbeddableFieldValue, inputType: string, expected: string): string {
  return `"value" of kind "${value.kind}" ignored: a ${inputType} field takes a value of kind ${expected}.`;
}

/**
 * Whether two values say the same thing, which decides whether a change is worth
 * publishing.
 *
 * A switch per member rather than a text comparison of the two. Both sides come from
 * `readFieldValue`, so serializing them would in fact have answered the question — and
 * it would have been the one place in this element where a value was handled as text
 * rather than as what it is. The switch is exhaustive, so a member added to the union
 * fails to compile here rather than comparing as unequal for ever.
 */
export function sameFieldValue(left: CedarEmbeddableFieldValue, right: CedarEmbeddableFieldValue): boolean {
  switch (left.kind) {
    case 'none':
      return right.kind === 'none';
    case 'literal':
      return right.kind === 'literal' && right.value === left.value;
    case 'number':
      return right.kind === 'number' && right.value === left.value;
    case 'temporal':
      return right.kind === 'temporal' && right.value === left.value;
    case 'iri':
      return right.kind === 'iri' && right.iri === left.iri && right.label === left.label;
    case 'literals':
      return right.kind === 'literals' && sameLiterals(left.values, right.values);
    case 'attributes':
      return right.kind === 'attributes' && sameAttributes(left.values, right.values);
  }
}

/** Order matters: it is the order the options were chosen in, and the widget shows it. */
function sameLiterals(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, at) => value === right[at]);
}

function sameAttributes(
  left: Readonly<Record<string, string | null>>,
  right: Readonly<Record<string, string | null>>,
): boolean {
  const names = Object.keys(left);
  return (
    names.length === Object.keys(right).length &&
    names.every((name) => Object.hasOwn(right, name) && right[name] === left[name])
  );
}
