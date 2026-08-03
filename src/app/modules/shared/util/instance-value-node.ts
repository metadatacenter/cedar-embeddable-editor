/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  InstanceDataAtomType,
  InstanceDataControlledAtom,
  InstanceDataLinkAtom,
  InstanceDataStringAtom,
  InstanceDataTypedAtom,
  JsonTemplateInstanceReader,
} from 'cedar-model-typescript-library';

/**
 * What a node in an instance is, and what it holds.
 *
 * CEE asked this in three places and answered it three ways: the quality report
 * sniffed `@value`, then `@id`, then `rdfs:label`; the validator checked `@id`
 * and `rdfs:label` independently; and `DataObjectUtil.deleteContext` matched on
 * exact key counts — two keys meaning a controlled term, one meaning a link,
 * anything else meaning a container to be stripped. That last rule destroyed
 * data: a controlled term or a link carrying a `@type`, which is ordinary
 * JSON-LD, has three keys and so had its `@id` deleted.
 *
 * The model library already decides this while parsing an instance, and records
 * the answer in the node's type. Asking it here means one rule instead of
 * three, and the same rule CEE now uses to read cardinality.
 */
export class InstanceValueNode {
  /**
   * True when this node is a field's value rather than an element.
   *
   * An element carries child properties; a value carries only value keys
   * (`@value`, `@id`, `rdfs:label`, `@type`, `skos:notation`). Note that an
   * element does not have to carry a `@context` to be one — CEE's extract copy
   * of an instance strips them.
   */
  static isValue(node: unknown): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JsonTemplateInstanceReader.isValueNode(node as any);
  }

  /**
   * This node as the library's typed atom.
   *
   * For consumers that need more than the plain value — the widgets want the
   * IRI and the label separately, and want to know which they are looking at.
   * An element, or anything that is not a value, comes back as an empty node.
   */
  static atom(node: unknown): InstanceDataAtomType {
    return JsonTemplateInstanceReader.readValueNode(node as any);
  }

  /**
   * The IRI this node carries, if it carries one.
   *
   * Both a link and a controlled term do; only a controlled term also has a
   * label. A field's own type decides which of the two to show, so both are
   * offered rather than one chosen here.
   */
  static iri(node: unknown): string | null | undefined {
    const atom = InstanceValueNode.atom(node);
    if (atom instanceof InstanceDataLinkAtom || atom instanceof InstanceDataControlledAtom) {
      return atom.id;
    }
    return undefined;
  }

  /** The label this node carries, if it carries one. */
  static label(node: unknown): string | null | undefined {
    const atom = InstanceValueNode.atom(node);
    return atom instanceof InstanceDataControlledAtom ? atom.label : undefined;
  }

  /**
   * The literal this node holds, exactly as stored.
   *
   * `undefined` means the node is not a literal at all, which is not the same
   * as a literal of `''` or `null` — both of which are values a field can
   * legitimately hold and which a widget has to be shown.
   */
  static literal(node: unknown): unknown {
    const atom = InstanceValueNode.atom(node);
    if (atom instanceof InstanceDataStringAtom || atom instanceof InstanceDataTypedAtom) {
      return atom.value;
    }
    return undefined;
  }

  /** True when this node holds a literal, however empty. */
  static isLiteral(node: unknown): boolean {
    const atom = InstanceValueNode.atom(node);
    return atom instanceof InstanceDataStringAtom || atom instanceof InstanceDataTypedAtom;
  }

  /** True when this node carries an IRI — a link or a controlled term. */
  static isIriBearing(node: unknown): boolean {
    const atom = InstanceValueNode.atom(node);
    return atom instanceof InstanceDataLinkAtom || atom instanceof InstanceDataControlledAtom;
  }

  /**
   * The plain value a field holds, or null when it holds nothing.
   *
   * `iriValued` says whether this field's value *is* its IRI — links and the
   * external authority types — which the instance alone cannot settle. A node
   * of `{@id, rdfs:label}` is a term to be shown by its label if the field is a
   * controlled term, and a resource to be shown by its IRI if the field is a
   * link. Everything else the node's own type answers.
   *
   * A node holding only `@id`, with no label, now reads as that IRI. It used to
   * read as empty for any field that was not IRI-valued, because the label was
   * looked up and was not there — so a controlled term that arrived without one
   * reported as unfilled and could not satisfy a requirement.
   */
  static plainValue(node: unknown, iriValued: boolean): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const atom = JsonTemplateInstanceReader.readValueNode(node as any);

    if (atom instanceof InstanceDataStringAtom || atom instanceof InstanceDataTypedAtom) {
      return InstanceValueNode.emptyToNull(atom.value);
    }
    if (atom instanceof InstanceDataControlledAtom) {
      return InstanceValueNode.emptyToNull(iriValued ? atom.id : atom.label);
    }
    if (atom instanceof InstanceDataLinkAtom) {
      return InstanceValueNode.emptyToNull(atom.id);
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static emptyToNull(value: any): any {
    if (value === '' || value === undefined) {
      return null;
    }
    return value;
  }
}
