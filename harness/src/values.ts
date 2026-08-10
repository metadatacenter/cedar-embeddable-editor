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
  CedarWriters,
  InstanceDataControlledAtom,
  InstanceDataEmptyAtom,
  InstanceDataLinkAtom,
  InstanceDataStringAtom,
  InstanceDataTypedAtom,
  JsonNode,
  InstanceDataAtomType,
  InstanceDataContainer,
  JsonTemplateInstanceReader,
  JsonTemplateInstanceWriter,
  TemplateInstanceBuilder,
} from 'cedar-model-typescript-library';
import type { InstanceObject } from '@cee/models/instance-node.model';

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

/*
 * The same rule for building a value as for reading one.
 *
 * A fixture written by hand as `{'@value': 'left over'}` was defended on the
 * grounds that a host really does hand CEE CEDAR JSON. It does — and the library
 * swallows it on arrival, before CEE sees any of it: `InstanceDeserializer.read`
 * passes it straight to the reader. So a hand-written fixture does not describe
 * CEE's interface, it describes the serialization, and it leaves the harness
 * knowing something neither CEE nor its tests should.
 *
 * `writeValueNode` is the mirror of the `readValueNode` above, so a spec says
 * what a field holds and the library decides how that is written down. The two
 * cannot drift, which is the same reason CEE builds its own nodes this way.
 */

/** An instance node holding a literal, with an XSD type when the field declares one. */
export const literalNode = (value: string | null, xsdType: string | null = null): JsonNode =>
  JsonTemplateInstanceWriter.writeValueNode(
    xsdType === null ? new InstanceDataStringAtom(value) : new InstanceDataTypedAtom(value, xsdType),
  ) as JsonNode;

/** An instance node holding an IRI and nothing else — a link, or an external authority. */
export const linkNode = (iri: string): JsonNode =>
  JsonTemplateInstanceWriter.writeValueNode(new InstanceDataLinkAtom(iri)) as JsonNode;

/** An instance node holding a controlled term: an IRI and the label it is shown by. */
export const termNode = (iri: string, label: string): JsonNode =>
  JsonTemplateInstanceWriter.writeValueNode(new InstanceDataControlledAtom(iri, label)) as JsonNode;

/** The node an unfilled IRI-valued slot holds, which is not an IRI of null. */
export const emptyNode = (): JsonNode =>
  JsonTemplateInstanceWriter.writeValueNode(new InstanceDataEmptyAtom()) as JsonNode;

/**
 * A whole instance holding one named value, as a host would hand it over.
 *
 * The envelope was the last thing specs assembled by hand — `@context`, `@id`
 * and `schema:isBasedOn` written out because an injected instance needs them.
 * `TemplateInstanceBuilder` and the JSON writer produce the same document from
 * the two facts a spec actually has: which template it is based on, and what is
 * in the field.
 */
export const instanceWith = (
  basedOn: string,
  values: Record<string, InstanceDataAtomType>,
  id: string | null = null,
): JsonNode => {
  const builder = new TemplateInstanceBuilder().withSchemaIsBasedOn(basedOn);
  if (id !== null) {
    builder.withAtId(id);
  }
  Object.entries(values).forEach(([key, atom]) => builder.withDataValue(key, atom));
  return CedarWriters.json().getFebruary2024().getTemplateInstanceWriter().getAsJsonNode(builder.build());
};

/** The atoms `instanceWith` takes, so a spec names a value rather than a shape. */
export const literalValue = (value: string | null): InstanceDataAtomType => new InstanceDataStringAtom(value);
export const linkValue = (iri: string): InstanceDataAtomType => new InstanceDataLinkAtom(iri);
export const termValue = (iri: string, label: string): InstanceDataAtomType =>
  new InstanceDataControlledAtom(iri, label);

/**
 * An element occurrence, and a list of them.
 *
 * The instance fixtures that were left after the single-value sweep were the
 * nested ones: an element carrying children, a multi element carrying several
 * occurrences of one. `InstanceDataContainer` is what the library calls that,
 * and `setValue` on it is how a child goes in — so a spec can describe the shape
 * it wants without writing a nested document.
 *
 * `id` is the element instance's own IRI, which CEE mints when it builds one and
 * a loaded instance carries. Left off where a spec does not care.
 */
export const containerValue = (
  children: Record<string, InstanceDataAtomType>,
  id: string | null = null,
): InstanceDataAtomType => {
  const container = new InstanceDataContainer();
  Object.entries(children).forEach(([key, atom]) => container.setValue(key, atom));
  if (id !== null) {
    container.id = id;
  }
  return container;
};

/** The occurrences of a multi child, in order. */
export const listValue = (...occurrences: InstanceDataAtomType[]): InstanceDataAtomType =>
  occurrences as unknown as InstanceDataAtomType;

/** The node a slot holds when nothing has been put in it. */
export const emptyValue = (): InstanceDataAtomType => new InstanceDataEmptyAtom();
