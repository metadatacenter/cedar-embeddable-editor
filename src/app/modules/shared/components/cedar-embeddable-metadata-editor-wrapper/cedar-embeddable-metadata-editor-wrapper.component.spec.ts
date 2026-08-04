import { CedarEmbeddableMetadataEditorWrapperComponent } from './cedar-embeddable-metadata-editor-wrapper.component';

/**
 * `outputSerialization` drives the host-facing `currentMetadataSerialized`
 * getter, while the typed getters and the save-path getter stay put.
 *
 * The instance is empty here (no template loaded), so YAML output is the empty
 * string and JSON output the empty object — enough to prove which branch the
 * config selects. `innerConfig` is set directly rather than through the `config`
 * setter, which would run the full initialise path; the getter only reads it.
 *
 * The one contract that must not move: `currentMetadata` is always a JSON object,
 * whatever `outputSerialization` says, because that is what the host saves.
 */
describe('CedarEmbeddableMetadataEditorWrapperComponent output serialization', () => {
  const make = (): CedarEmbeddableMetadataEditorWrapperComponent =>
    new CedarEmbeddableMetadataEditorWrapperComponent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any, // controlledFieldDataService
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { trace: (): void => undefined } as any, // messageHandlerService
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any, // sampleTemplateService
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any, // activeComponentRegistry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any, // translateService
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { trace: (): void => undefined } as any, // messagingService (HandlerContext)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any, // globalSettingsContextService
    );

  it('serializes output as a YAML string when outputSerialization is "yaml"', () => {
    const component = make();
    component.innerConfig = { outputSerialization: 'yaml' };
    expect(typeof component.currentMetadataSerialized).toBe('string');
  });

  it('serializes output as a JSON object by default', () => {
    expect(typeof make().currentMetadataSerialized).toBe('object');
  });

  it('serializes output as a JSON object when outputSerialization is "json"', () => {
    const component = make();
    component.innerConfig = { outputSerialization: 'json' };
    expect(typeof component.currentMetadataSerialized).toBe('object');
  });

  it('keeps currentMetadata a JSON object regardless of outputSerialization', () => {
    const component = make();
    component.innerConfig = { outputSerialization: 'yaml' };
    expect(typeof component.currentMetadata).toBe('object');
    expect(typeof component.currentMetadataYaml).toBe('string');
  });
});
