import { type Mock, vi } from 'vitest';
import { CedarEmbeddableMetadataEditorWrapperComponent } from './cedar-embeddable-metadata-editor-wrapper.component';
import { ElementRef } from '@angular/core';
import { ControlledFieldDataService, INTEGRATED_SEARCH_PATH } from '../../service/controlled-field-data.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { GlobalSettingsContextService } from '../../service/global-settings-context.service';
import {
  FakeMissingTranslationHandler,
  TranslateDefaultParser,
  TranslateFakeCompiler,
  TranslateService,
  TranslateStore,
} from '@ngx-translate/core';
import { InstanceDataContainer } from 'cedar-model-typescript-library';
import { InstanceObject } from '../../models/instance-node.model';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { FallbackTranslateLoader } from '../../util/fallback-translate-loader';

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
    setIntegratedSearchUrl: Mock;
    setDefaultLang: Mock;
    use: Mock;
    getLangs: Mock;
    reloadLang: Mock;
    setTranslation: Mock;
    clearRegistry: Mock;
    globalSettings: { languageMapPathPrefix?: string };
  }

  const make = (): { component: CedarEmbeddableMetadataEditorWrapperComponent; mocks: Mocks } => {
    const mocks: Mocks = {
      setIntegratedSearchUrl: vi.fn(),
      setDefaultLang: vi.fn(),
      use: vi.fn(),
      // No language loaded yet, which is every case in this describe: the doubles
      // below record calls and load nothing. What happens once a map *is* loaded from
      // one source and the host names another is the subject of the real-service test
      // at the end of this file, which a double of `use` cannot answer.
      getLangs: vi.fn(() => []),
      reloadLang: vi.fn(),
      setTranslation: vi.fn(),
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
        setIntegratedSearchUrl: mocks.setIntegratedSearchUrl,
      } as unknown as ControlledFieldDataService,
      messaging as unknown as MessageHandlerService,
      { clear: mocks.clearRegistry } as unknown as ActiveComponentRegistryService,
      {
        setDefaultLang: mocks.setDefaultLang,
        use: mocks.use,
        getLangs: mocks.getLangs,
        reloadLang: mocks.reloadLang,
        setTranslation: mocks.setTranslation,
      } as unknown as TranslateService,
      messaging as unknown as MessageHandlerService,
      mocks.globalSettings as unknown as GlobalSettingsContextService,
    );
    return { component, mocks };
  };

  it('applies config identically whether Angular supplies it before or after ngOnInit', () => {
    const config = {
      terminologyBaseUrl: '/terminology/',
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
      expectCalledOnceWith(candidate.mocks.setIntegratedSearchUrl, '/terminology/' + INTEGRATED_SEARCH_PATH);
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
      { setIntegratedSearchUrl: vi.fn() } as unknown as ControlledFieldDataService,
      messaging as unknown as MessageHandlerService,
      { clear: vi.fn() } as unknown as ActiveComponentRegistryService,
      {
        setDefaultLang: vi.fn(),
        use: vi.fn(),
        getLangs: vi.fn(() => []),
        reloadLang: vi.fn(),
        setTranslation: vi.fn(),
      } as unknown as TranslateService,
      messaging as unknown as MessageHandlerService,
      {} as unknown as GlobalSettingsContextService,
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

/**
 * Language configuration arriving after the artifact, against the real translation
 * service.
 *
 * A double of `TranslateService` cannot answer this, and the ordering test above is
 * the demonstration: it asserts `use` was called with the language the late config
 * named, which a double always records. The real service has two guards behind that
 * call — `use()` returns at once when the language asked for is already current, and
 * `retrieveTranslations` reaches the loader only when it holds no map for the
 * language — so a host that rendered a template first and then named a
 * `languageMapPathPrefix` got no fetch at all, and kept the built-in labels. That
 * went out in a shipped bundle with a green suite.
 *
 * So this wires up what production wires up: the real `TranslateService`, the real
 * `FallbackTranslateLoader` reading the prefix at load time, and an `HttpClient`
 * standing in for the network and counting what was asked of it. `of(...)` makes
 * every load synchronous, so the assertions need no waiting.
 */
describe('CedarEmbeddableMetadataEditorWrapperComponent late language configuration', () => {
  const BUILT_IN = { Generic: { ExpandAll: 'Expand All' } };
  const EXTERNAL = { Generic: { ExpandAll: 'Alles Aufklappen' } };
  const PREFIX = '/languages/';

  interface Wired {
    component: CedarEmbeddableMetadataEditorWrapperComponent;
    translate: TranslateService;
    fetched: string[];
  }

  const wire = (): Wired => {
    const fetched: string[] = [];
    const http = {
      get: (url: string) => {
        fetched.push(url);
        return of(EXTERNAL);
      },
    } as unknown as HttpClient;
    const messaging = { trace: (): void => undefined, traceGroup: (): void => undefined, error: vi.fn() };
    const globalSettings = new GlobalSettingsContextService();
    const loader = new FallbackTranslateLoader(http, messaging as unknown as MessageHandlerService, globalSettings, {
      en: BUILT_IN,
    });
    // The empty default language matters: a language passed here would be loaded by
    // the constructor, before the component has said anything.
    const translate = new TranslateService(
      new TranslateStore(),
      loader,
      new TranslateFakeCompiler(),
      new TranslateDefaultParser(),
      new FakeMissingTranslationHandler(),
      true,
      false,
      false,
      '',
    );
    const component = new CedarEmbeddableMetadataEditorWrapperComponent(
      new ElementRef(document.createElement('cedar-embeddable-editor')),
      { setIntegratedSearchUrl: vi.fn() } as unknown as ControlledFieldDataService,
      messaging as unknown as MessageHandlerService,
      { clear: vi.fn() } as unknown as ActiveComponentRegistryService,
      translate,
      messaging as unknown as MessageHandlerService,
      globalSettings,
    );
    return { component, translate, fetched };
  };

  it('loads the named language map when the template arrived first', () => {
    const { component, translate, fetched } = wire();
    /*
     * The event an already-rendered editor depends on, and the half of the repair
     * that a loaded map does not evidence. `reloadLang` alone puts the new labels
     * where `instant` finds them while every rendered widget goes on showing the old
     * ones, because the fetch stores its result silently. `onTranslationChange` is
     * what the pipes are subscribed to, so this is how the test sees what a reader
     * would see.
     */
    const announced: string[] = [];
    translate.onTranslationChange.subscribe((event) => announced.push(event.lang));

    component.ngOnInit();
    component.templateObject = new InstanceDataContainer();

    // The built-in map, since the host has named no source yet.
    expect(translate.instant('Generic.ExpandAll')).toBe('Expand All');
    expect(fetched).toEqual([]);

    component.config = { languageMapPathPrefix: PREFIX };

    expect(fetched, 'the late prefix reached no loader').toEqual([PREFIX + 'en.json']);
    expect(translate.instant('Generic.ExpandAll'), 'the editor kept the built-in label').toBe('Alles Aufklappen');
    expect(announced, 'nothing told the rendered widgets to re-read their labels').toEqual(['en']);
  });

  it('loads it once when the host configures before supplying the template', () => {
    const { component, translate, fetched } = wire();

    component.ngOnInit();
    component.config = { languageMapPathPrefix: PREFIX };
    component.templateObject = new InstanceDataContainer();

    expect(fetched).toEqual([PREFIX + 'en.json']);
    expect(translate.instant('Generic.ExpandAll')).toBe('Alles Aufklappen');
  });

  /**
   * A late config naming a different language gets past both guards on its own, so
   * the repair must not add a second fetch of the map `use()` has just loaded. Only
   * `en`, loaded from the built-in map before the prefix existed, is stale.
   */
  it('fetches each language once when the late config also changes the language', () => {
    const { component, fetched } = wire();

    component.ngOnInit();
    component.templateObject = new InstanceDataContainer();
    component.config = { languageMapPathPrefix: PREFIX, defaultLanguage: 'de' };

    expect(fetched.filter((url) => url === PREFIX + 'de.json')).toHaveLength(1);
    expect(fetched.filter((url) => url === PREFIX + 'en.json')).toHaveLength(1);
  });

  it('leaves the built-in map alone when the host names no source', () => {
    const { component, translate, fetched } = wire();

    component.ngOnInit();
    component.templateObject = new InstanceDataContainer();
    component.config = { readOnlyMode: true };

    expect(fetched).toEqual([]);
    expect(translate.instant('Generic.ExpandAll')).toBe('Expand All');
  });
});
