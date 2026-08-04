import { CedarEmbeddableMetadataEditorComponent } from './cedar-embeddable-metadata-editor.component';
import { ModelLibraryTemplateParser } from '../../factory/model-library-template-parser';
import { YamlTemplateParser } from '../../factory/yaml-template-parser';

/**
 * The `inputSerialization` config selects which parser reads a host's template.
 *
 * JSON by default — the contract every existing host relies on — and the YAML
 * parser only when the config asks for it. Constructed directly with a stub
 * message handler; the config setter only reads flags, so nothing else is
 * needed to exercise the choice.
 */
describe('CedarEmbeddableMetadataEditorComponent input serialization', () => {
  const make = (): CedarEmbeddableMetadataEditorComponent =>
    new CedarEmbeddableMetadataEditorComponent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      null as any, // activeComponentRegistry — untouched by the config setter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { setEndpoints: (): void => undefined } as any, // externalAuthorityLookupService — called per authority descriptor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { trace: (): void => undefined } as any, // messageHandlerService
    );

  it('defaults to the JSON parser when no serialization is configured', () => {
    expect(make().templateParser instanceof ModelLibraryTemplateParser).toBe(true);
  });

  it('keeps the JSON parser when inputSerialization is "json"', () => {
    const component = make();
    component.config = { inputSerialization: 'json' };
    expect(component.templateParser instanceof ModelLibraryTemplateParser).toBe(true);
  });

  it('switches to the YAML parser when inputSerialization is "yaml"', () => {
    const component = make();
    component.config = { inputSerialization: 'yaml' };
    expect(component.templateParser instanceof YamlTemplateParser).toBe(true);
  });

  it('leaves the parser at the JSON default when other config keys are set', () => {
    const component = make();
    component.config = { collapseStaticComponents: true };
    expect(component.templateParser instanceof ModelLibraryTemplateParser).toBe(true);
  });
});
