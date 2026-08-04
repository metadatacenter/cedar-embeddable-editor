import { CedarEmbeddableMetadataEditorComponent } from './cedar-embeddable-metadata-editor.component';
import { ModelLibraryTemplateParser } from '../../factory/model-library-template-parser';
import { YamlTemplateParser } from '../../factory/yaml-template-parser';

/**
 * The `config` object is the CEE's host-facing API, and its setter is the one
 * place a renamed key or a dropped `Object.hasOwn` block would silently stop a
 * host's setting from taking effect. These pin the mapping: every config key
 * reaches the field or behaviour it names, keys are independent, and an absent
 * key leaves the default.
 *
 * The component is built directly with a stub message handler and a stub
 * external-authority service (the setter calls `setEndpoints` for each authority
 * descriptor on every config). The setter only reads flags, so nothing else is
 * needed.
 */
describe('CedarEmbeddableMetadataEditorComponent config', () => {
  const make = (): CedarEmbeddableMetadataEditorComponent =>
    new CedarEmbeddableMetadataEditorComponent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      null as any, // activeComponentRegistry — untouched by the config setter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { setEndpoints: (): void => undefined } as any, // externalAuthorityLookupService
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { trace: (): void => undefined } as any, // messageHandlerService
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const field = (component: CedarEmbeddableMetadataEditorComponent, name: string): any =>
    (component as unknown as Record<string, unknown>)[name];

  // For every boolean display flag the config key and the field it sets share a
  // name, so one list drives both sides of the assertion.
  const BOOLEAN_FLAGS = [
    'showTemplateRenderingRepresentation',
    'showMultiInstanceInfo',
    'showTemplateSourceData',
    'showInstanceDataCore',
    'showInstanceDataFull',
    'showDataQualityReport',
    'showSampleTemplateLinks',
    'showHeader',
    'showFooter',
    'expandedTemplateRenderingRepresentation',
    'expandedMultiInstanceInfo',
    'expandedTemplateSourceData',
    'expandedInstanceDataCore',
    'expandedInstanceDataFull',
    'expandedDataQualityReport',
    'expandedSampleTemplateLinks',
    'collapseStaticComponents',
    'showStaticText',
    'showAllMultiInstanceValues',
    'showTemplateDescription',
    'readOnlyMode',
    'showPreferencesMenu',
  ];

  describe('every boolean flag maps its config key to its field', () => {
    BOOLEAN_FLAGS.forEach((flag) => {
      it(`${flag} follows the configured value both ways`, () => {
        const component = make();
        component.config = { [flag]: true };
        expect(field(component, flag)).toBe(true);
        component.config = { [flag]: false };
        expect(field(component, flag)).toBe(false);
      });
    });
  });

  describe('inputSerialization selects the template parser', () => {
    it('defaults to the JSON parser when unset', () => {
      expect(make().templateParser instanceof ModelLibraryTemplateParser).toBe(true);
    });

    it('keeps the JSON parser when set to "json"', () => {
      const component = make();
      component.config = { inputSerialization: 'json' };
      expect(component.templateParser instanceof ModelLibraryTemplateParser).toBe(true);
    });

    it('switches to the YAML parser when set to "yaml"', () => {
      const component = make();
      component.config = { inputSerialization: 'yaml' };
      expect(component.templateParser instanceof YamlTemplateParser).toBe(true);
    });
  });

  describe('typed (non-boolean) config values', () => {
    it('extAuthBaseUrl overrides the external-authority base URL', () => {
      const component = make();
      component.config = { extAuthBaseUrl: 'https://example.org/ext-auth/' };
      expect(component.extAuthBaseUrl).toBe('https://example.org/ext-auth/');
    });
  });

  describe('config keys do not interfere with one another', () => {
    it('setting one key leaves the other fields and the parser untouched', () => {
      const component = make();
      const untouchedFlag = component.showInstanceDataFull;
      const parser = component.templateParser;

      component.config = { showHeader: true };

      expect(component.showHeader).toBe(true);
      expect(component.showInstanceDataFull).toBe(untouchedFlag);
      expect(component.templateParser).toBe(parser);
    });

    it('an empty config changes nothing', () => {
      const component = make();
      const parser = component.templateParser;
      const sourceData = component.showTemplateSourceData;

      component.config = {};

      expect(component.templateParser).toBe(parser);
      expect(component.showTemplateSourceData).toBe(sourceData);
    });
  });
});
