import { type Mock, vi } from 'vitest';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './cedar-embeddable-metadata-editor-wrapper.component';
import { ElementRef } from '@angular/core';
import { IriPrefix } from '../../util/iri-prefix';
import { ControlledFieldDataService } from '../../service/controlled-field-data.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';
import { TranslateService } from '@ngx-translate/core';
import { InstanceDataContainer } from 'cedar-model-typescript-library';
import { InstanceObject } from '../../models/instance-node.model';

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
    setTerminologyIntegratedSearchUrl: Mock;
    setDefaultLang: Mock;
    use: Mock;
    clearRegistry: Mock;
    globalSettings: { languageMapPathPrefix?: string };
  }

  const make = (): { component: CedarEmbeddableMetadataEditorWrapperComponent; mocks: Mocks } => {
    const mocks: Mocks = {
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
      { clear: mocks.clearRegistry } as unknown as ActiveComponentRegistryService,
      { setDefaultLang: mocks.setDefaultLang, use: mocks.use } as unknown as TranslateService,
      messaging as unknown as MessageHandlerService,
      mocks.globalSettings as unknown as GlobalSettingsContextService,
      new IriPrefix(),
    );
    return { component, mocks };
  };

  it('applies config identically whether Angular supplies it before or after ngOnInit', () => {
    const config = {
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
      expectCalledOnceWith(candidate.mocks.setTerminologyIntegratedSearchUrl, '/terminology/search');
      expect(candidate.mocks.globalSettings.languageMapPathPrefix).toBe('/languages/');
      expectCalledOnceWith(candidate.mocks.setDefaultLang, 'fr');
      expectCalledOnceWith(candidate.mocks.use, 'hu');
      expect(candidate.component.handlerContext.readOnlyMode).toBe(true);
    }
  });

  /**
   * A host with nothing to say must be able to say it.
   *
   * Every key on `CeeConfig` is optional and documents a default, so an unset
   * configuration and `{}` have to mean the same thing. They did not: the editor
   * rendered only once `config` had been assigned, so an element given a template
   * and nothing else stayed blank for good — `currentMetadata` answering `{}` and
   * `currentMetadataYaml` answering `''`, with no error and nothing in the console
   * tying the blank frame to a key nobody set.
   */
  it('renders on a template alone, taking every default', () => {
    const { component, mocks } = make();

    component.ngOnInit();
    component.templateObject = new InstanceDataContainer();

    expect(component.editorDataReady(), 'a template alone did not build the editor').toBe(true);
    // The languages a host did not choose, which is what a blank editor never reached.
    expectCalledOnceWith(mocks.setDefaultLang, 'en');
    expectCalledOnceWith(mocks.use, 'en');
    expect(component.handlerContext.readOnlyMode).toBe(false);
  });

  /**
   * Rendering no longer waits for configuration, so for the first time the two can
   * arrive in either order around the render. Config assigned second must still
   * apply — the settings it carries reach already-built widgets through services
   * they subscribe to, rather than by being read once at construction.
   */
  it('applies configuration assigned after the template', () => {
    const { component, mocks } = make();

    component.ngOnInit();
    component.templateObject = new InstanceDataContainer();
    component.config = { defaultLanguage: 'hu', readOnlyMode: true };

    expect(component.editorDataReady()).toBe(true);
    expect(mocks.use).toHaveBeenLastCalledWith('hu');
    expect(component.handlerContext.readOnlyMode).toBe(true);
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
  } => {
    const errors = vi.fn();
    const messaging = { trace: (): void => undefined, traceGroup: (): void => undefined, error: errors };
    const component = new CedarEmbeddableMetadataEditorWrapperComponent(
      new ElementRef(document.createElement('cedar-embeddable-editor')),
      { setTerminologyIntegratedSearchUrl: vi.fn() } as unknown as ControlledFieldDataService,
      messaging as unknown as MessageHandlerService,
      { clear: vi.fn() } as unknown as ActiveComponentRegistryService,
      { setDefaultLang: vi.fn(), use: vi.fn() } as unknown as TranslateService,
      messaging as unknown as MessageHandlerService,
      {} as unknown as GlobalSettingsContextService,
      new IriPrefix(),
    );
    return { component, errors };
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
});
