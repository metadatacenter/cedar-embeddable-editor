import { type Mock, vi } from 'vitest';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './cedar-embeddable-metadata-editor-wrapper.component';
import { ElementRef } from '@angular/core';
import { Subject } from 'rxjs';
import { IriPrefix } from '../../util/iri-prefix';

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
      new ElementRef(document.createElement('cedar-embeddable-editor')),
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
      new IriPrefix(),
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

/**
 * Jasmine's `toHaveBeenCalledOnceWith`, in the two assertions it stood for.
 *
 * Vitest 1.x has no single matcher for "called exactly once, and with these
 * arguments". Both halves are load-bearing below: the test asserts that config is
 * applied identically whether Angular supplies it before or after `ngOnInit`, so a
 * second, identical call would be a real failure rather than a harmless repeat.
 */
const expectCalledOnceWith = (spy: Mock, ...args: unknown[]): void => {
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith(...args);
};

describe('CedarEmbeddableMetadataEditorWrapperComponent lifecycle', () => {
  interface Mocks {
    templateJson$: Subject<object>;
    metadataJson$: Subject<object>;
    loadTemplate: Mock;
    setTerminologyIntegratedSearchUrl: Mock;
    setDefaultLang: Mock;
    use: Mock;
    clearRegistry: Mock;
    globalSettings: { languageMapPathPrefix?: string };
  }

  const make = (): { component: CedarEmbeddableMetadataEditorWrapperComponent; mocks: Mocks } => {
    const mocks: Mocks = {
      templateJson$: new Subject<object>(),
      metadataJson$: new Subject<object>(),
      loadTemplate: vi.fn(),
      setTerminologyIntegratedSearchUrl: vi.fn(),
      setDefaultLang: vi.fn(),
      use: vi.fn(),
      clearRegistry: vi.fn(),
      globalSettings: {},
    };
    const messaging = { trace: (): void => undefined, traceGroup: (): void => undefined };
    const component = new CedarEmbeddableMetadataEditorWrapperComponent(
      new ElementRef(document.createElement('cedar-embeddable-editor')),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { setTerminologyIntegratedSearchUrl: mocks.setTerminologyIntegratedSearchUrl } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messaging as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        templateJson$: mocks.templateJson$,
        metadataJson$: mocks.metadataJson$,
        loadTemplate: mocks.loadTemplate,
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { clear: mocks.clearRegistry } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { setDefaultLang: mocks.setDefaultLang, use: mocks.use } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messaging as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mocks.globalSettings as any,
      new IriPrefix(),
    );
    return { component, mocks };
  };

  it('stops reacting to sample-template streams after destruction', () => {
    const { component, mocks } = make();
    const first = { title: 'first template' };
    const firstMetadata = { title: 'first metadata' };
    component.ngOnInit();

    mocks.templateJson$.next({ first });
    mocks.metadataJson$.next({ first: firstMetadata });
    expect(component.templateAndInstanceJson).toEqual({ templateObject: first, instanceObject: firstMetadata });

    component.ngOnDestroy();
    expect(mocks.clearRegistry).toHaveBeenCalledTimes(1);
    mocks.templateJson$.next({ second: { title: 'second template' } });
    mocks.metadataJson$.next({ second: { title: 'second metadata' } });

    expect(component.templateAndInstanceJson).toEqual({ templateObject: first, instanceObject: firstMetadata });
  });

  it('applies config identically whether Angular supplies it before or after ngOnInit', () => {
    const config = {
      sampleTemplateLocationPrefix: '/samples/',
      loadSampleTemplateName: 'example',
      terminologyIntegratedSearchUrl: '/terminology/search',
      showSpinnerBeforeInit: false,
      languageMapPathPrefix: '/languages/',
      fallbackLanguage: 'fr',
      defaultLanguage: 'hu',
      readOnlyMode: true,
      hideEmptyFields: true,
    };
    const before = make();
    const after = make();

    before.component.config = config;
    before.component.ngOnInit();
    after.component.ngOnInit();
    after.component.config = config;

    for (const candidate of [before, after]) {
      expectCalledOnceWith(candidate.mocks.loadTemplate, '/samples/', 'example');
      expectCalledOnceWith(candidate.mocks.setTerminologyIntegratedSearchUrl, '/terminology/search');
      expect(candidate.component.showSpinnerBeforeInit).toBe(false);
      expect(candidate.mocks.globalSettings.languageMapPathPrefix).toBe('/languages/');
      expectCalledOnceWith(candidate.mocks.setDefaultLang, 'fr');
      expectCalledOnceWith(candidate.mocks.use, 'hu');
      expect(candidate.component.handlerContext.readOnlyMode).toBe(true);
      expect(candidate.component.handlerContext.hideEmptyFields).toBe(true);
    }
  });
});
