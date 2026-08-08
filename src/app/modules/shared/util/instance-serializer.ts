import { CedarReaders, CedarWriters, JsonNode, TemplateInstance } from 'cedar-model-typescript-library';
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
  /** The working tree as the library's model. */
  private static parse(instance: InstanceFullData): TemplateInstance {
    return CedarReaders.json()
      .getFebruary2024()
      .getTemplateInstanceReader()
      .readFromObject(instance as unknown as JsonNode).instance;
  }

  /**
   * The instance as CEDAR JSON, written by the library.
   *
   * `InstanceObject` rather than `object`: what comes back is an instance root,
   * which is the same thing `InstanceDeserializer.read` takes — and the round-trip
   * test feeds this straight back into it. The library types its writer's output
   * as `JsonNode`, so the conversion is named here, once, at the boundary.
   */
  static toJson(instance: InstanceFullData): InstanceObject {
    if (instance == null) {
      return {};
    }
    return CedarWriters.json()
      .getFebruary2024()
      .getTemplateInstanceWriter()
      .getAsJsonNode(InstanceSerializer.parse(instance)) as unknown as InstanceObject;
  }

  /** The same instance as CEDAR YAML. */
  static toYaml(instance: InstanceFullData): string {
    if (instance == null) {
      return '';
    }
    return CedarWriters.yaml()
      .getStrict()
      .getTemplateInstanceWriter()
      .getAsYamlString(InstanceSerializer.parse(instance));
  }
}
