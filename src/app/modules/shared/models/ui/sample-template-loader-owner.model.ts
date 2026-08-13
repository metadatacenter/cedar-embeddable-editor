/**
 * What the sample-template components need from the object that owns them.
 *
 * `CedarEmbeddableMetadataEditorWrapperComponent` assigns itself
 * (`this.sampleTemplateLoaderObject = this`) and the editor passes it down as
 * `callbackOwnerObject`. Naming the whole wrapper here would be both circular and
 * far wider than the truth: the three components that receive it read exactly one
 * property off it and call nothing.
 *
 * So this describes the read rather than the object, which is also what keeps the
 * dependency one-way — the children depend on a shape, not on their parent.
 */
export interface SampleTemplateLoaderOwner {
  /** The host-supplied configuration, whose values are whatever the host put there. */
  innerConfig: Record<string, unknown> | null;
}
