import { type Mock, vi } from 'vitest';
import { CedarEmbeddableMetadataEditorComponent } from './cedar-embeddable-metadata-editor.component';
import { TemplateTrustService } from '../../service/template-trust.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { AUTHORITY_DESCRIPTORS } from '../../models/authority/authority-descriptor.model';
import { IriPrefix } from '../../util/iri-prefix';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import { HandlerContext } from '../../util/handler-context';
import { DataContext } from '../../util/data-context';
import { UserPreferencesService } from '../../service/user-preferences.service';

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
  const make = (
    setEndpoints: (...args: unknown[]) => void = (): void => undefined,
  ): CedarEmbeddableMetadataEditorComponent =>
    new CedarEmbeddableMetadataEditorComponent(
      // `as unknown as T` throughout, not `as any`. A stub only needs the members
      // the test exercises, but naming the target type keeps the constructor's
      // shape in the test: change a parameter and the double stops compiling.
      null as unknown as ActiveComponentRegistryService, // untouched by the config setter
      { setEndpoints } as unknown as ExternalAuthorityLookupService,
      { trace: (): void => undefined } as unknown as MessageHandlerService,
      new IriPrefix(),
      // A real one: it holds a boolean and nothing else, so a stub would be more
      // code than the thing it replaces.
      new TemplateTrustService(),
      new UserPreferencesService(),
    );

  /**
   * Read a field by name, including the ones the class does not expose.
   *
   * `unknown`, so every assertion below has to say what it expects rather than
   * being handed a value that satisfies anything.
   */
  const field = (component: CedarEmbeddableMetadataEditorComponent, name: string): unknown =>
    (component as unknown as Record<string, unknown>)[name];

  // For every boolean display flag the config key and the field it sets share a
  // name, so one list drives both sides of the assertion.
  const BOOLEAN_FLAGS = [
    'showTemplateRenderingRepresentation',
    'showMultiInstanceInfo',
    'showTemplateSourceData',
    'showTemplateYaml',
    'showInstanceDataCore',
    'showInstanceDataFull',
    'showInstanceYaml',
    'showDataQualityReport',
    'showHeader',
    'showFooter',
    'expandedTemplateRenderingRepresentation',
    'expandedMultiInstanceInfo',
    'expandedTemplateSourceData',
    'expandedTemplateYaml',
    'expandedInstanceDataCore',
    'expandedInstanceDataFull',
    'expandedInstanceYaml',
    'expandedDataQualityReport',
    'showTemplateDescription',
    'readOnlyMode',
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

  describe('YAML source-panel defaults', () => {
    it('keeps the new YAML panels off unless the host opts in', () => {
      const component = make();

      expect(component.showTemplateYaml).toBe(false);
      expect(component.showInstanceYaml).toBe(false);
    });

    it('can be configured independently of the corresponding JSON panel', () => {
      const component = make();

      component.config = {
        showTemplateSourceData: false,
        showTemplateYaml: true,
        showInstanceDataFull: false,
        showInstanceYaml: true,
      };

      expect(component.showTemplateYaml).toBe(true);
      expect(component.showInstanceYaml).toBe(true);
    });
  });

  describe('typed (non-boolean) config values', () => {
    it('defaults external-authority lookups to the production CEDAR bridge', () => {
      expect(make().extAuthBaseUrl).toBe('https://bridge.metadatacenter.org/ext-auth/');
    });

    it('keeps all IRI prefixes on this editor instance', () => {
      const prefixes = new IriPrefix();
      const component = new CedarEmbeddableMetadataEditorComponent(
        null as unknown as ActiveComponentRegistryService,
        // `as unknown as T`, not `as any`. A stub only needs the members this test
        // exercises, but naming the target type keeps the constructor's shape in the
        // test: change a parameter and the double stops compiling, which `any` would
        // have hidden.
        { setEndpoints: (): void => undefined } as unknown as ExternalAuthorityLookupService,
        { trace: (): void => undefined } as unknown as MessageHandlerService,
        prefixes,
        new TemplateTrustService(),
        new UserPreferencesService(),
      );

      component.config = {
        iriPrefix: 'https://example.org/artifacts/',
        bioPortalPrefix: 'https://example.org/bioportal/',
        orcidPrefix: 'https://example.org/orcid/',
        rorPrefix: 'https://example.org/ror/',
      };

      expect(prefixes.get()).toBe('https://example.org/artifacts/');
      expect(prefixes.getBioPortalPrefix()).toBe('https://example.org/bioportal/');
      expect(prefixes.getOrcidPrefix()).toBe('https://example.org/orcid/');
      expect(prefixes.getRorPrefix()).toBe('https://example.org/ror/');
    });

    it('extAuthBaseUrl overrides the external-authority base URL', () => {
      const component = make();
      component.config = { extAuthBaseUrl: 'https://example.org/ext-auth/' };
      expect(component.extAuthBaseUrl).toBe('https://example.org/ext-auth/');
    });

    it('configures the default search and details endpoints for every authority', () => {
      const setEndpoints = vi.fn();
      const component = make(setEndpoints);

      component.config = {};

      expect(setEndpoints).toHaveBeenCalledTimes(AUTHORITY_DESCRIPTORS.length);
      for (const descriptor of AUTHORITY_DESCRIPTORS) {
        expect(setEndpoints).toHaveBeenCalledWith(
          descriptor.inputType,
          component.extAuthBaseUrl + descriptor.defaultSearchPath,
          component.extAuthBaseUrl + descriptor.defaultDetailsPath,
        );
      }
    });

    it('honours custom search and details paths independently for every authority', () => {
      const setEndpoints = vi.fn();
      const component = make(setEndpoints);
      const base = 'https://example.org/ext-auth/';
      const config = AUTHORITY_DESCRIPTORS.reduce(
        (value, descriptor, index) => ({
          ...value,
          [descriptor.searchUrlConfigKey]: `search-${index}`,
          [descriptor.detailsUrlConfigKey]: `details-${index}`,
        }),
        { extAuthBaseUrl: base },
      );

      component.config = config;

      expect(setEndpoints).toHaveBeenCalledTimes(AUTHORITY_DESCRIPTORS.length);
      AUTHORITY_DESCRIPTORS.forEach((descriptor, index) => {
        expect(setEndpoints).toHaveBeenCalledWith(
          descriptor.inputType,
          `${base}search-${index}`,
          `${base}details-${index}`,
        );
      });
    });
  });

  describe('config keys do not interfere with one another', () => {
    it('setting one key leaves the other fields untouched', () => {
      const component = make();
      const untouchedFlag = component.showInstanceDataFull;

      component.config = { showHeader: true };

      expect(component.showHeader).toBe(true);
      expect(component.showInstanceDataFull).toBe(untouchedFlag);
    });

    it('an empty config changes nothing', () => {
      const component = make();
      const sourceData = component.showTemplateSourceData;

      component.config = {};

      expect(component.showTemplateSourceData).toBe(sourceData);
    });
  });

  describe('registry lifecycle', () => {
    const makeWithRegistry = (): {
      component: CedarEmbeddableMetadataEditorComponent;
      clear: Mock;
      setInputTemplate: Mock;
    } => {
      const clear = vi.fn();
      const setInputTemplate = vi.fn();
      const component = new CedarEmbeddableMetadataEditorComponent(
        { clear } as unknown as ActiveComponentRegistryService,
        { setEndpoints: (): void => undefined } as unknown as ExternalAuthorityLookupService,
        { trace: (): void => undefined } as unknown as MessageHandlerService,
        new IriPrefix(),
        new TemplateTrustService(),
        new UserPreferencesService(),
      );
      component.handlerContext = {} as unknown as HandlerContext;
      component.dataContext = { setInputTemplate, instanceFullData: {} } as unknown as DataContext;
      return { component, clear, setInputTemplate };
    };

    it('clears obsolete registrations after a replacement template is accepted', () => {
      const { component, clear, setInputTemplate } = makeWithRegistry();
      // Keep the setter's deferred instance initialization inert in this unit test.
      // `initDataFromInstance` is private, so the spy needs a view of the component
      // that admits it. Naming the one member is narrower than `any` and says which
      // private the test is reaching for.
      vi.spyOn(
        component as unknown as { initDataFromInstance: () => Promise<void> },
        'initDataFromInstance',
      ).mockReturnValue(Promise.resolve());

      component.templateJsonObject = { title: 'replacement' };

      expect(setInputTemplate).toHaveBeenCalledTimes(1);
      expect(clear).toHaveBeenCalledTimes(1);
      // Ordering matters: the replacement template has to be taken before the old
      // registrations are dropped. Jasmine spelled this `toHaveBeenCalledBefore`;
      // Vitest exposes the call ordinals instead.
      expect(setInputTemplate.mock.invocationCallOrder[0]).toBeLessThan(clear.mock.invocationCallOrder[0]);
    });

    it('clears the registry when the editor is destroyed', () => {
      const { component, clear } = makeWithRegistry();

      component.ngOnDestroy();

      expect(clear).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Read-only reaches the widgets from configuration, and from nothing else.
 *
 * The widgets subscribe to `UserPreferencesService`, and the only thing that ever
 * wrote to it was the preferences menu — so the host's own flag reached the form by
 * passing through a UI control. That is how the control came to be able to override
 * host policy, and why the menu had to stay instantiated even when configured
 * invisible, or read-only never arrived. The menu is gone and this is the wiring that
 * replaced it.
 */
describe('CedarEmbeddableMetadataEditorComponent read-only wiring', () => {
  const make = (): { component: CedarEmbeddableMetadataEditorComponent; modes: boolean[] } => {
    const modes: boolean[] = [];
    const preferences = new UserPreferencesService();
    preferences.readOnlyMode$.subscribe((mode) => modes.push(mode));
    const component = new CedarEmbeddableMetadataEditorComponent(
      { clear: vi.fn() } as unknown as ActiveComponentRegistryService,
      { setEndpoints: (): void => undefined } as unknown as ExternalAuthorityLookupService,
      { trace: (): void => undefined } as unknown as MessageHandlerService,
      new IriPrefix(),
      new TemplateTrustService(),
      preferences,
    );
    return { component, modes };
  };

  it('publishes read-only to the widgets when the host asks for it', () => {
    const { component, modes } = make();

    component.config = { readOnlyMode: true };

    expect(modes.at(-1)).toBe(true);
  });

  it('publishes an editable form when the host does not', () => {
    const { component, modes } = make();

    component.config = { showHeader: true };

    expect(modes.at(-1)).toBe(false);
  });
});
