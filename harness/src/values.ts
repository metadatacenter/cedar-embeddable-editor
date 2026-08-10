/**
 * Reading a value out of an instance without naming a serialization key.
 *
 * A spec that writes "One" into a controlled-term field and then asserts
 * `{'@id': 'https://x/1', 'rdfs:label': 'One'}` is making two claims at once:
 * that CEE put the value in the right slot, which is CEE's to get right, and
 * that a controlled term is written as those two keys, which is the model
 * library's. Only the first is this suite's business, and pinning the second
 * means every spec has to move when the serialization does — which is exactly
 * what the instance tree is being moved off.
 *
 * So these ask the library what a node holds. `readValueNode` is the same
 * classifier the library uses when it parses an instance, and the atom it
 * returns is the answer: a literal has a value, a link has an IRI, a controlled
 * term has both. No key appears in a spec that uses them.
 *
 * Deliberately the library rather than CEE's own `InstanceValueNode`, which
 * wraps the same calls. A test that read values through the code under test
 * would agree with it whether or not either was right.
 */
import {
  InstanceDataControlledAtom,
  InstanceDataLinkAtom,
  InstanceDataStringAtom,
  InstanceDataTypedAtom,
  JsonNode,
  JsonTemplateInstanceReader,
} from 'cedar-model-typescript-library';

const atomOf = (node: unknown) => JsonTemplateInstanceReader.readValueNode(node as JsonNode);

/**
 * The literal a node holds.
 *
 * `undefined` when the node is not a literal at all, which a spec should treat
 * as a different outcome from a literal of `null` or `''` — both of which are
 * values a field can legitimately hold.
 */
export const literalOf = (node: unknown): string | null | undefined => {
  const atom = atomOf(node);
  return atom instanceof InstanceDataStringAtom || atom instanceof InstanceDataTypedAtom ? atom.value : undefined;
};

/** The IRI a node carries — a link or a controlled term. */
export const iriOf = (node: unknown): string | null | undefined => {
  const atom = atomOf(node);
  return atom instanceof InstanceDataLinkAtom || atom instanceof InstanceDataControlledAtom ? atom.id : undefined;
};

/** The label a node carries, which only a controlled term has. */
export const labelOf = (node: unknown): string | null | undefined => {
  const atom = atomOf(node);
  return atom instanceof InstanceDataControlledAtom ? atom.label : undefined;
};

/** The XSD type a node declares alongside its value, if it declares one. */
export const xsdTypeOf = (node: unknown): string | null | undefined => {
  const atom = atomOf(node);
  return atom instanceof InstanceDataTypedAtom ? atom.type : undefined;
};

/**
 * True when the node holds a literal.
 *
 * The question "was this written as a literal rather than as an IRI" comes up
 * whenever a field changes kind or a stale value could survive a write, and it
 * used to be asked as `Object.hasOwn(node, '@value')` — which is the same
 * question with the answer's spelling baked in.
 */
export const isLiteral = (node: unknown): boolean =>
  atomOf(node) instanceof InstanceDataStringAtom || atomOf(node) instanceof InstanceDataTypedAtom;

/** True when the node carries an IRI, whether or not it also carries a label. */
export const isIriBearing = (node: unknown): boolean =>
  atomOf(node) instanceof InstanceDataLinkAtom || atomOf(node) instanceof InstanceDataControlledAtom;

/** A controlled term's pair, for asserting both halves at once. */
export const termOf = (node: unknown): { iri: string | null | undefined; label: string | null | undefined } => ({
  iri: iriOf(node),
  label: labelOf(node),
});
