import { type Mock, vi } from 'vitest';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './cedar-embeddable-metadata-editor-wrapper.component';
import { ElementRef } from '@angular/core';
import { Subject } from 'rxjs';
import { IriPrefix } from '../../util/iri-prefix';
import { ControlledFieldDataService } from '../../service/controlled-field-data.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import { SampleTemplatesService } from '../sample-templates/sample-templates.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';
import { TranslateService } from '@ngx-translate/core';
import { InstanceDataContainer } from 'cedar-model-typescript-library';
import { InstanceObject } from '../../models/instance-node.model';

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
    // `as unknown as T` throughout, for the reason given on the lifecycle suite's
    // own doubles below: naming the service each stands in for keeps the
    // constructor's shape under test, which `as any` would have hidden.
    new CedarEmbeddableMetadataEditorWrapperComponent(
      new ElementRef(document.createElement('cedar-embeddable-editor')),
      {} as unknown as ControlledFieldDataService,
      { trace: (): void => undefined } as unknown as MessageHandlerService,
      {} as unknown as SampleTemplatesService,
      {} as unknown as ActiveComponentRegistryService,
      {} as unknown as TranslateService,
      { trace: (): void => undefined } as unknown as MessageHandlerService, // messagingService (HandlerContext)
      {} as unknown as GlobalSettingsContextService,
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
    // `as unknown as T` throughout, rather than `as any`. Each double implements only
    // what this test exercises, which is the point of a double — but naming the
    // service it stands in for keeps the constructor's shape under test. Reorder or
    // retype a parameter and these stop compiling; under `as any` they would have
    // gone on silently standing in for the wrong thing.
    const component = new CedarEmbeddableMetadataEditorWrapperComponent(
      new ElementRef(document.createElement('cedar-embeddable-editor')),
      {
        setTerminologyIntegratedSearchUrl: mocks.setTerminologyIntegratedSearchUrl,
      } as unknown as ControlledFieldDataService,
      messaging as unknown as MessageHandlerService,
      {
        templateJson$: mocks.templateJson$,
        metadataJson$: mocks.metadataJson$,
        loadTemplate: mocks.loadTemplate,
      } as unknown as SampleTemplatesService,
      { clear: mocks.clearRegistry } as unknown as ActiveComponentRegistryService,
      { setDefaultLang: mocks.setDefaultLang, use: mocks.use } as unknown as TranslateService,
      messaging as unknown as MessageHandlerService,
      mocks.globalSettings as unknown as GlobalSettingsContextService,
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
      languageMapPathPrefix: '/languages/',
      fallbackLanguage: 'fr',
      defaultLanguage: 'hu',
      readOnlyMode: true,
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
      expect(candidate.mocks.globalSettings.languageMapPathPrefix).toBe('/languages/');
      expectCalledOnceWith(candidate.mocks.setDefaultLang, 'fr');
      expectCalledOnceWith(candidate.mocks.use, 'hu');
      expect(candidate.component.handlerContext.readOnlyMode).toBe(true);
    }
  });
});

/**
 * Every input on the element takes one assignment and keeps it.
 *
 * The element used only ever to accumulate state: a second `config` patched the
 * first for most keys and replaced it for `outputSerialization`, and three inputs
 * could each supply an artifact with nothing saying which won. So a host could
 * never say "here is what I want now", only "here is one more thing on top of
 * whatever you already have" — and the same assignments in a different order gave a
 * different editor, with no way back to a known one short of a new element. Which is
 * now the supported way to get different behaviour.
 */
describe('CedarEmbeddableMetadataEditorWrapperComponent set-once inputs', () => {
  const make = (): {
    component: CedarEmbeddableMetadataEditorWrapperComponent;
    errors: Mock;
    templateJson$: Subject<object>;
    metadataJson$: Subject<object>;
  } => {
    const errors = vi.fn();
    const templateJson$ = new Subject<object>();
    const metadataJson$ = new Subject<object>();
    const messaging = { trace: (): void => undefined, traceGroup: (): void => undefined, error: errors };
    const component = new CedarEmbeddableMetadataEditorWrapperComponent(
      new ElementRef(document.createElement('cedar-embeddable-editor')),
      { setTerminologyIntegratedSearchUrl: vi.fn() } as unknown as ControlledFieldDataService,
      messaging as unknown as MessageHandlerService,
      { templateJson$, metadataJson$, loadTemplate: vi.fn() } as unknown as SampleTemplatesService,
      { clear: vi.fn() } as unknown as ActiveComponentRegistryService,
      { setDefaultLang: vi.fn(), use: vi.fn() } as unknown as TranslateService,
      messaging as unknown as MessageHandlerService,
      {} as unknown as GlobalSettingsContextService,
      new IriPrefix(),
    );
    return { component, errors, templateJson$, metadataJson$ };
  };

  /**
   * A distinguishable artifact, built rather than cast.
   *
   * Which object was kept is the whole question here, so identity is all these need
   * and none of them looks inside one. `id` makes a failure report readable.
   */
  const artifact = (id: string): InstanceObject => {
    const container = new InstanceDataContainer();
    container.id = id;
    return container;
  };

  /** What the host was told, as one string. */
  const reported = (errors: Mock): string => errors.mock.calls.map(([message]) => String(message)).join('\n');

  it('keeps the first configuration and reports the second', () => {
    const { component, errors } = make();
    component.ngOnInit();

    component.config = { defaultLanguage: 'hu' };
    component.config = { defaultLanguage: 'fr' };

    expect(component.innerConfig).toEqual({ defaultLanguage: 'hu' });
    expect(reported(errors)).toContain('"config" ignored, because the editor is already configured');
  });

  /**
   * A framework host binding `[config]` can deliver null before it has anything to
   * send, so a null must not spend the one assignment it is entitled to.
   */
  it('does not let a null configuration spend the assignment', () => {
    const { component, errors } = make();
    component.ngOnInit();

    component.config = null;
    component.config = { defaultLanguage: 'hu' };

    expect(component.innerConfig).toEqual({ defaultLanguage: 'hu' });
    expect(errors).not.toHaveBeenCalled();
  });

  it('keeps the first template and reports the second', () => {
    const { component, errors } = make();
    const first = artifact('first');

    component.templateObject = first;
    component.templateObject = artifact('second');

    expect(component.templateJson).toBe(first);
    expect(reported(errors)).toContain('"templateObject" ignored, because the template is already set');
  });

  /**
   * The two separate inputs are independent claims, which is what lets a host set
   * them in either order — the route three of the six consumers take.
   */
  it('accepts a template and an instance as one assignment each', () => {
    const { component, errors } = make();
    const template = artifact('template');
    const instance = artifact('instance');

    component.instanceObject = instance;
    component.templateObject = template;

    expect(component.instanceJson).toBe(instance);
    expect(component.templateJson).toBe(template);
    expect(errors).not.toHaveBeenCalled();
  });

  it('keeps the first instance and reports the second', () => {
    const { component, errors } = make();
    const first = artifact('first');

    component.instanceObject = first;
    component.instanceObject = artifact('second');

    expect(component.instanceJson).toBe(first);
    expect(reported(errors)).toContain('"instanceObject" ignored, because the instance is already set');
  });

  it('spends both claims on the combined input, so neither separate input follows it', () => {
    const { component, errors } = make();
    component.templateAndInstanceObject = { templateObject: artifact('t'), instanceObject: artifact('i') };

    component.templateObject = artifact('template');
    component.instanceObject = artifact('instance');

    expect(component.templateJson).toBeNull();
    expect(component.instanceJson).toBeNull();
    expect(reported(errors)).toContain('"templateObject" ignored');
    expect(reported(errors)).toContain('"instanceObject" ignored');
  });

  it('refuses the combined input after either separate one', () => {
    const { component, errors } = make();
    component.instanceObject = artifact('instance');

    component.templateAndInstanceObject = { templateObject: artifact('t'), instanceObject: artifact('i') };

    expect(component.templateAndInstanceJson).toBeNull();
    expect(reported(errors)).toContain('"templateAndInstanceObject" ignored, because the instance is already set');
  });

  it('names both halves when the combined input follows itself', () => {
    const { component, errors } = make();
    const first = { templateObject: artifact('first'), instanceObject: artifact('i') };

    component.templateAndInstanceObject = first;
    component.templateAndInstanceObject = { templateObject: artifact('second'), instanceObject: artifact('i') };

    expect(component.templateAndInstanceJson).toBe(first);
    expect(reported(errors)).toContain(
      '"templateAndInstanceObject" ignored, because the template and instance are already set',
    );
  });

  /**
   * The sample-template loader is CEE's own developer feature and loads a different
   * sample on every click, which is exactly the reassignment a host may not perform.
   * It writes through the internal path, so the claims do not bind it.
   */
  it('lets the sample-template loader load one sample after another', () => {
    const { component, errors, templateJson$, metadataJson$ } = make();
    component.ngOnInit();

    templateJson$.next({ first: { title: 'first template' } });
    metadataJson$.next({ first: { title: 'first metadata' } });
    templateJson$.next({ second: { title: 'second template' } });
    metadataJson$.next({ second: { title: 'second metadata' } });

    expect(component.templateAndInstanceJson).toEqual({
      templateObject: { title: 'second template' },
      instanceObject: { title: 'second metadata' },
    });
    expect(errors).not.toHaveBeenCalled();
  });
});
