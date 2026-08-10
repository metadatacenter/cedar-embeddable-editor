import {
  CedarReaders,
  CedarWriters,
  InstanceInflater,
  JsonNode,
  Template,
  TemplateInstance,
} from 'cedar-model-typescript-library';
import { InstanceFullData } from '../models/instance-full-data.model';
import { InstanceObject } from '../models/instance-node.model';

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
   * Without a template it is skipped rather than failed. A host can read
   * `currentMetadata` before a template has been parsed, and an instance written
   * from whatever the tree already carries is a better answer than none.
   */
  /**
   * The instance the writers are handed.
   *
   * A pass-through, plus the template contract when there is one. It used to
   * *parse*: CEE's working tree was a CEDAR JSON document, so emitting it meant
   * handing the library's reader the tree CEE had just been editing and letting
   * it build a model. That round trip was the clearest evidence the tree was a
   * document rather than a model — it is a `TemplateInstance` now, so there is
   * nothing to read.
   *
   * Without a template the contract is skipped rather than failed. A host can
   * read `currentMetadata` before a template has been parsed, and an instance
   * written from what the tree carries is a better answer than none.
   */
  private static contracted(instance: TemplateInstance, template: Template | null): TemplateInstance {
    return template === null ? instance : InstanceInflater.inflate(instance, template);
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
    if (instance == null) {
      return {} as JsonNode;
    }
    return CedarWriters.json()
      .getFebruary2024()
      .getTemplateInstanceWriter()
      .getAsJsonNode(InstanceSerializer.contracted(instance, template));
  }

  /** The same instance as CEDAR YAML. */
  static toYaml(instance: TemplateInstance | null, template: Template | null = null): string {
    if (instance == null) {
      return '';
    }
    return CedarWriters.yaml()
      .getStrict()
      .getTemplateInstanceWriter()
      .getAsYamlString(InstanceSerializer.contracted(instance, template));
  }
}
