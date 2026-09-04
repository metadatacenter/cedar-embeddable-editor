import {
  InstanceDataAtomType,
  InstanceDataContainer,
  InstanceDataControlledAtom,
  InstanceDataEmptyAtom,
  InstanceDataLinkAtom,
  InstanceDataStringAtom,
  InstanceDataTypedAtom,
} from 'cedar-model-typescript-library';
import { InstanceNode } from '../models/instance-node.model';

/**
 * What a node in an instance holds.
 *
 * CEE asked this in three places and answered it three ways: the quality report
 * sniffed `@value`, then `@id`, then `rdfs:label`; the validator checked `@id`
 * and `rdfs:label` independently; and `DataObjectUtil.deleteContext` matched on
 * exact key counts — two keys meaning a controlled term, one meaning a link,
 * anything else meaning a container to be stripped. That last rule destroyed
 * data: a controlled term carrying a `@type`, which is ordinary JSON-LD, has
 * three keys and so had its `@id` deleted.
 *
 * There is no sniffing left to do. A node is one of the library's atoms and its
 * class *is* the answer, so these are `instanceof` tests over a value that
 * arrived typed rather than guesses about a shape. The class used to run every
 * read through `readValueNode` first, because the tree was JSON and the atom had
 * to be recovered from it each time.
 *
 * Gone with that: `VALUE_KEYS`, the list of the five keys a value node may carry.
 * CEE kept it in order to clear a stale one when a field's value changed kind,
 * and could not derive it — the library's own set is private, and writing one of
 * each atom yields four of the five because none carries a `skos:notation`. A
 * value is replaced rather than edited now, so there is nothing to clear and
 * nothing to keep in step.
 */
export class InstanceValueNode {
  /**
   * True when this node is a field's value rather than an element.
   *
   * An element is a container of named children; anything else is a value, or a
   * list of them.
   */
  static isValue(node: unknown): boolean {
    return !(node instanceof InstanceDataContainer) && !Array.isArray(node);
  }

  /**
   * The IRI this node carries, if it carries one.
   *
   * Both a link and a controlled term do; only a controlled term also has a
   * label. A field's own type decides which of the two to show, so both are
   * offered rather than one chosen here.
   */
  static iri(node: InstanceNode | null | undefined): string | null | undefined {
    if (node instanceof InstanceDataLinkAtom || node instanceof InstanceDataControlledAtom) {
      return node.id;
    }
    return undefined;
  }

  /** The label this node carries, if it carries one. */
  static label(node: InstanceNode | null | undefined): string | null | undefined {
    return node instanceof InstanceDataControlledAtom ? node.label : undefined;
  }

  /**
   * The literal this node holds, exactly as stored.
   *
   * `undefined` means the node is not a literal at all, which is not the same
   * as a literal of `''` or `null` — both of which are values a field can
   * legitimately hold and which a widget has to be shown.
   */
  static literal(node: InstanceNode | null | undefined): string | null | undefined {
    if (node instanceof InstanceDataStringAtom || node instanceof InstanceDataTypedAtom) {
      return node.value;
    }
    return undefined;
  }

  /** True when this node holds a literal, however empty. */
  static isLiteral(node: InstanceNode | null | undefined): boolean {
    return node instanceof InstanceDataStringAtom || node instanceof InstanceDataTypedAtom;
  }

  /** True when this node carries an IRI — a link or a controlled term. */
  static isIriBearing(node: InstanceNode | null | undefined): boolean {
    return node instanceof InstanceDataLinkAtom || node instanceof InstanceDataControlledAtom;
  }

  /**
   * Whether this node, or any occurrence in it, actually holds a field value.
   *
   * Read-only instance rendering needs this before choosing between a value widget and the
   * structured specification box. An empty typed atom is still a real node, so presence alone is
   * not enough; conversely, the string `0` and an IRI with no label are both genuine values. Looking
   * at all three atom payloads keeps that distinction without asking the field type how to display
   * the value.
   */
  static holdsValue(node: InstanceNode | null | undefined): boolean {
    if (Array.isArray(node)) {
      return node.some((entry) => InstanceValueNode.holdsValue(entry));
    }
    if (node === null || node === undefined || !InstanceValueNode.isValue(node)) {
      return false;
    }
    return [InstanceValueNode.literal(node), InstanceValueNode.iri(node), InstanceValueNode.label(node)].some(
      (value) => value !== null && value !== undefined && value !== '',
    );
  }

  /**
   * The plain value a field holds, or null when it holds nothing.
   *
   * `iriValued` says whether this field's value *is* its IRI — links and the
   * external authority types — which the instance alone cannot settle. A term
   * carrying an IRI and a label is shown by its label if the field is a
   * controlled term, and by its IRI if the field is a link. Everything else the
   * node's own type answers.
   *
   * A node holding only an IRI, with no label, reads as that IRI. It used to
   * read as empty for any field that was not IRI-valued, because the label was
   * looked up and was not there — so a controlled term that arrived without one
   * reported as unfilled and could not satisfy a requirement.
   */
  static plainValue(node: InstanceNode | null | undefined, iriValued: boolean): string | null {
    if (node instanceof InstanceDataStringAtom || node instanceof InstanceDataTypedAtom) {
      return InstanceValueNode.emptyToNull(node.value);
    }
    if (node instanceof InstanceDataControlledAtom) {
      return InstanceValueNode.emptyToNull(iriValued ? node.id : node.label);
    }
    if (node instanceof InstanceDataLinkAtom) {
      return InstanceValueNode.emptyToNull(node.id);
    }
    return null;
  }

  /**
   * The value a literal field holds, with the XSD type the field declares.
   *
   * These four were `…Json` and returned the JSON a value is written as. They
   * return the value itself now: what a field holds is CEE's, how it is written
   * down is the library's, and the two met here only because CEE's tree was a
   * document.
   */
  static literalValue(value: string | null, xsdType: string | null = null): InstanceDataAtomType {
    return xsdType === null ? new InstanceDataStringAtom(value) : new InstanceDataTypedAtom(value, xsdType);
  }

  /**
   * What an *unfilled* slot holds.
   *
   * Nothing at all for an IRI-valued field — there is no IRI of null, and the
   * library refuses to build one — and an empty literal otherwise, carrying the
   * XSD type when the field declares one.
   */
  static emptySlot(iriValued: boolean, xsdType: string | null = null): InstanceDataAtomType {
    if (iriValued) {
      return new InstanceDataEmptyAtom();
    }
    return InstanceValueNode.literalValue(null, xsdType);
  }

  /** An IRI value, with a label when there is one. */
  static iriValue(iri: string, label?: string | null): InstanceDataAtomType {
    return label === undefined || label === null || label === ''
      ? new InstanceDataLinkAtom(iri)
      : new InstanceDataControlledAtom(iri, label);
  }

  /*
   * Every atom the library hands back exposes `string | null`, so that is what this
   * folds an empty string or an absent value into. `undefined` is checked as well as
   * `''` because a missing value and an empty one are both the same unfilled slot.
   */
  private static emptyToNull(value: string | null | undefined): string | null {
    if (value === '' || value === undefined) {
      return null;
    }
    return value;
  }
}
