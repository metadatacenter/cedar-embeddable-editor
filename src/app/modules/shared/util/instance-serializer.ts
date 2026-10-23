import {
  CedarArtifactId,
  CedarWriters,
  InstanceInflater,
  JsonNode,
  Template,
  TemplateInstance,
} from 'cedar-model-typescript-library';
import { cloneDeep } from 'lodash-es';

/**
 * Hand the instance out in whatever serialisation is asked for.
 *
 * CEE keeps a live tree of plain objects while the form is open, because the
 * widgets hold references into it and mutate it in place. That tree is internal
 * and its shape is CEE's own business. What leaves CEE is not: an instance a
 * host page saves is a CEDAR artifact, and CEDAR — not CEE — decides what one
 * looks like.
 *
 * So the working tree is read into the library's model on the way out and the
 * library writes it. CEE no longer produces CEDAR JSON; it produces a
 * `TemplateInstance`, and asking for YAML instead is a different writer rather
 * than a different code path.
 *
 * `instance-output.spec.ts` holds this to two things: that the JSON out is
 * unchanged from what CEE used to build by hand, across every corpus instance
 * and every generated template, and that the YAML out reads back as the same
 * instance.
 */
export class InstanceSerializer {
  /** The template a comparable instance that names none is written as naming. */
  private static readonly STAND_IN_TEMPLATE = 'urn:cee:stand-in-template';

  /**
   * Whether there is an instance here a writer can be given.
   *
   * The null check is the ordinary case — a host can read `currentMetadata`
   * before anything has been loaded. The data container is checked as well
   * because a caller can hold a partially built instance: replacing a template
   * writes the current one out and reads it back, and it does that on a timer,
   * so what is in hand when the timer fires is not something this can assume.
   */
  private static isWritable(instance: TemplateInstance | null): instance is TemplateInstance {
    return instance != null && instance.dataContainer != null;
  }

  /**
   * Whether the instance names the template it is based on.
   *
   * Both writers refuse an instance that does not, and an instance of an unsaved
   * template names none, since only a saved template has an identifier.
   */
  static namesTemplate(instance: TemplateInstance | null): boolean {
    return InstanceSerializer.isWritable(instance) && instance.schema_isBasedOn.getValue() !== null;
  }

  /**
   * The working tree as the library's model, completed against its template.
   *
   * `InstanceInflater` is what makes the `@context` the library's answer rather
   * than CEE's. It copies each child's property IRI onto the data container,
   * which is what the JSON writer builds `@context` from, re-adds a slot for any
   * child the tree omits, and orders children as the template declares them. CEE
   * assembles the same `@context` into its working tree from the same
   * `getChildIriMap`, so the emitted document does not change — what changes is
   * which side is authoritative, and that CEE's copy stops being load-bearing on
   * the way out.
   *
   * A repeated child the tree omits is re-added as an empty list, not at its lower
   * bound. The tree omits one only when the stored instance did, and the form then
   * shows no occurrences of it. Writing the occurrences the library would start it
   * with would save entries the user never saw, and the quality report, which
   * describes the tree, would no longer describe the document CEE writes.
   *
   * Without a template it is skipped rather than failed. A host can read
   * `currentMetadata` before a template has been parsed, and an instance written
   * from whatever the tree already carries is a better answer than none.
   */
  private static contracted(instance: TemplateInstance, template: Template | null): TemplateInstance {
    // Export completion must not repair the live model merely because a host
    // reads currentMetadata; structural findings clear only after a real edit.
    if (template === null) return instance;
    // Envelope wrappers include canonical null sentinels whose identity the
    // model writer recognizes. Inflation only mutates the data container.
    const copy: TemplateInstance = Object.assign(Object.create(Object.getPrototypeOf(instance)), instance);
    copy.dataContainer = cloneDeep(instance.dataContainer);
    return InstanceInflater.inflate(copy, template, 'empty');
  }

  /**
   * The instance as CEDAR JSON, written by the library.
   *
   * `InstanceObject` rather than `object`: what comes back is an instance root,
   * which is the same thing `InstanceDeserializer.read` takes — and the round-trip
   * test feeds this straight back into it. The library types its writer's output
   * as `JsonNode`, so the conversion is named here, once, at the boundary.
   */
  static toJson(instance: TemplateInstance | null, template: Template | null = null): JsonNode {
    if (!InstanceSerializer.isWritable(instance)) {
      return {} as JsonNode;
    }
    return CedarWriters.json()
      .getFebruary2024()
      .getTemplateInstanceWriter()
      .getAsJsonNode(InstanceSerializer.contracted(instance, template));
  }

  /**
   * What a host reads as `currentMetadata` for an instance CEE holds.
   *
   * The instance as CEDAR JSON, or the empty object while it names no template,
   * which the writer refuses to write. A host reading a property is not owed an
   * exception for that.
   */
  static toHostJson(instance: TemplateInstance | null, template: Template | null = null): JsonNode {
    return InstanceSerializer.namesTemplate(instance) ? InstanceSerializer.toJson(instance, template) : {};
  }

  /**
   * The instance as CEDAR JSON, for telling one state of the form from the next.
   *
   * The same document `toJson` writes wherever it writes one. An instance that
   * names no template has none, since the writer refuses it, and its edits still
   * have to be told apart, so it is written as though it named a stand-in
   * template. The result is compared and never handed to a host.
   */
  static toComparableJson(instance: TemplateInstance | null, template: Template | null = null): JsonNode {
    if (!InstanceSerializer.isWritable(instance) || InstanceSerializer.namesTemplate(instance)) {
      return InstanceSerializer.toJson(instance, template);
    }
    const named: TemplateInstance = Object.assign(Object.create(Object.getPrototypeOf(instance)), instance);
    named.schema_isBasedOn = CedarArtifactId.forValue(InstanceSerializer.STAND_IN_TEMPLATE);
    return InstanceSerializer.toJson(named, template);
  }

  /** The same instance as CEDAR YAML, optionally in the library's compact form. */
  static toYaml(
    instance: TemplateInstance | null,
    template: Template | null = null,
    isCompact: boolean = false,
  ): string {
    if (!InstanceSerializer.isWritable(instance)) {
      return '';
    }
    return CedarWriters.yaml()
      .getStrict()
      .getTemplateInstanceWriter()
      .getAsYamlString(InstanceSerializer.contracted(instance, template), isCompact);
  }

  /**
   * What a host reads as `currentMetadataYaml` for an instance CEE holds.
   *
   * The instance as CEDAR YAML, or the empty string where the writer refuses it,
   * as it refuses one that names no template, as an instance of an unsaved
   * template does, and one that has no name. A host reading a property is not
   * owed an exception for that.
   */
  static toHostYaml(instance: TemplateInstance | null, template: Template | null = null): string {
    try {
      return InstanceSerializer.toYaml(instance, template);
    } catch {
      return '';
    }
  }
}
