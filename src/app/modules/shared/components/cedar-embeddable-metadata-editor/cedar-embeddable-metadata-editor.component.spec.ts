import { type Mock, vi } from 'vitest';
import { CedarEmbeddableMetadataEditorComponent } from './cedar-embeddable-metadata-editor.component';
import { TemplateTrustService } from '../../service/template-trust.service';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { AUTHORITY_DESCRIPTORS } from '../../models/authority/authority-descriptor.model';
import { ExternalAuthorityLookupService } from '../../service/external-authority-lookup.service';
import { MessageHandlerService } from '../../service/message-handler.service';
import { HandlerContext } from '../../util/handler-context';
import { DataContext } from '../../util/data-context';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { RenderSchedulerService } from '../../service/render-scheduler.service';

const renderScheduler = (): RenderSchedulerService =>
  ({ schedule: vi.fn(() => Promise.resolve(false)) }) as unknown as RenderSchedulerService;

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
      {
        trace: (): void => undefined,
        error: (): void => undefined,
        ready: (): void => undefined,
      } as unknown as MessageHandlerService,
      // A real one: it holds a boolean and nothing else, so a stub would be more
      // code than the thing it replaces.
      new TemplateTrustService(),
      new UserPreferencesService(),
      renderScheduler(),
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
  const BOOLEAN_FLAGS = ['showDownloadMenu', 'showTemplateDescription', 'readOnlyMode'];

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

  describe('typed (non-boolean) config values', () => {
    /**
     * No default, because CEE cannot know which deployment it is embedded in.
     *
     * This field held a `.orgx` hostname for a year and then the production
     * bridge, and both were wrong for somebody: the first resolved nowhere off
     * the machine it was written on, and the second sent a local stack's
     * authority lookups to production without the host asking or knowing.
     */
    it('names no bridge server of its own', () => {
      expect(make().bridgeBaseUrl).toBeNull();
    });

    it('bridgeBaseUrl names the bridge server, and nothing below it', () => {
      const component = make();
      component.config = { bridgeBaseUrl: 'https://example.org/' };
      expect(component.bridgeBaseUrl).toBe('https://example.org/');
    });

    /**
     * A host that names no bridge server gets no endpoints, rather than fourteen
     * relative ones.
     *
     * Concatenating an absent base would leave `orcid/search-by-name`, which
     * `HttpClient` resolves against the embedding page — so an unconfigured
     * lookup would fire a request per keystroke at the host's own origin. Both
     * frontends that never set this key are served from origins that answer such
     * a path with a 404.
     */
    it('registers no endpoints when the host names no bridge server', () => {
      const setEndpoints = vi.fn();
      const component = make(setEndpoints);

      component.config = {};

      expect(setEndpoints).not.toHaveBeenCalled();
      expect(component.bridgeBaseUrl).toBeNull();
    });

    it('treats an empty base URL as no base URL', () => {
      const setEndpoints = vi.fn();
      const component = make(setEndpoints);

      component.config = { bridgeBaseUrl: '' };

      expect(setEndpoints).not.toHaveBeenCalled();
      expect(component.bridgeBaseUrl).toBeNull();
    });

    /**
     * The host names a server; CEE builds all fourteen URLs under it.
     *
     * Both segments below the base are CEE's own — the bridge server's
     * external-authority resource, and then the authority's own two paths — so
     * the assertion spells the whole URL rather than trusting the constants that
     * built it. A host that had to supply `…/ext-auth/` was still restating one
     * of them, in four deployment configs.
     */
    it('builds every endpoint under the base the host named', () => {
      const setEndpoints = vi.fn();
      const component = make(setEndpoints);

      component.config = { bridgeBaseUrl: 'https://example.org/' };

      expect(setEndpoints).toHaveBeenCalledTimes(AUTHORITY_DESCRIPTORS.length);
      for (const descriptor of AUTHORITY_DESCRIPTORS) {
        expect(setEndpoints).toHaveBeenCalledWith(
          descriptor.inputType,
          `https://example.org/ext-auth/${descriptor.searchPath}`,
          `https://example.org/ext-auth/${descriptor.detailsPath}`,
        );
      }
    });
  });

  describe('config keys do not interfere with one another', () => {
    it('setting one key leaves the other fields untouched', () => {
      const component = make();
      const untouchedFlag = component.showTemplateDescription;

      component.config = { showDownloadMenu: true };

      expect(component.showDownloadMenu).toBe(true);
      expect(component.showTemplateDescription).toBe(untouchedFlag);
    });

    it('an empty config changes nothing', () => {
      const component = make();
      const description = component.showTemplateDescription;

      component.config = {};

      expect(component.showTemplateDescription).toBe(description);
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
        {
          trace: (): void => undefined,
          error: (): void => undefined,
          ready: (): void => undefined,
        } as unknown as MessageHandlerService,
        new TemplateTrustService(),
        new UserPreferencesService(),
        renderScheduler(),
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
      vi.spyOn(component as unknown as { initDataFromInstance: () => void }, 'initDataFromInstance').mockReturnValue();

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
      {
        trace: (): void => undefined,
        error: (): void => undefined,
        ready: (): void => undefined,
      } as unknown as MessageHandlerService,
      new TemplateTrustService(),
      preferences,
      renderScheduler(),
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
