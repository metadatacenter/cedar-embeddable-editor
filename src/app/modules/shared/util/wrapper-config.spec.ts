import { vi } from 'vitest';
import { of } from 'rxjs';
import { TranslateLoader, TranslateService } from '@ngx-translate/core';
import { ControlledFieldDataService, INTEGRATED_SEARCH_PATH } from '../service/controlled-field-data.service';
import { GlobalSettingsContextService } from '../service/global-settings-context.service';
import { MessageHandlerService } from '../service/message-handler.service';
import { DataContext } from './data-context';
import { HandlerContext } from './handler-context';
import { WrapperConfigCoordinator } from './wrapper-config-coordinator';
import type { CeeConfig } from './config-reader';

const make = (loaded: string[] = []) => {
  const error = vi.fn();
  const trace = vi.fn();
  const traceGroup = vi.fn();
  const setIntegratedSearchUrl = vi.fn();
  const setFallbackLang = vi.fn();
  const use = vi.fn();
  const reloadLang = vi.fn();
  const deleteLanguage = vi.fn();
  const setTranslation = vi.fn();
  const getTranslation = vi.fn((language: string) => of({ Generic: { ExpandAll: 'Expand ' + language } }));
  const globals = { languageMapPathPrefix: null } as GlobalSettingsContextService;
  const coordinator = new WrapperConfigCoordinator(
    { setIntegratedSearchUrl } as unknown as ControlledFieldDataService,
    { error, trace, traceGroup } as unknown as MessageHandlerService,
    {
      getLangs: () => loaded,
      setFallbackLang,
      use,
      reloadLang,
      deleteLanguage,
      setTranslation,
    } as unknown as TranslateService,
    { getTranslation } as unknown as TranslateLoader,
    globals,
  );
  const context = () => {
    const data = new DataContext();
    return new HandlerContext(data, { error } as unknown as MessageHandlerService);
  };
  return {
    coordinator,
    context,
    globals,
    error,
    setIntegratedSearchUrl,
    setFallbackLang,
    use,
    reloadLang,
    deleteLanguage,
    setTranslation,
    getTranslation,
  };
};

describe('WrapperConfigCoordinator', () => {
  it('applies documented defaults when the host supplies no config', () => {
    const r = make();
    const context = r.context();

    r.coordinator.apply(context);

    expect(r.setFallbackLang).toHaveBeenCalledWith('en');
    expect(r.use).toHaveBeenCalledWith('en');
    expect(context.readOnlyMode).toBe(false);
  });

  it('reapplies one accepted configuration to every replacement artifact context', () => {
    const r = make();
    expect(
      r.coordinator.accept({
        terminologyBaseUrl: '/terminology/',
        fallbackLanguage: 'fr',
        defaultLanguage: 'hu',
        readOnlyMode: true,
      }),
    ).toBe(true);
    const first = r.context();
    const replacement = r.context();

    r.coordinator.apply(first);
    r.coordinator.apply(replacement);

    expect(r.setIntegratedSearchUrl).toHaveBeenCalledWith('/terminology/' + INTEGRATED_SEARCH_PATH);
    expect(r.setFallbackLang).toHaveBeenLastCalledWith('fr');
    expect(r.use).toHaveBeenLastCalledWith('hu');
    expect(first.readOnlyMode).toBe(true);
    expect(replacement.readOnlyMode).toBe(true);
  });

  it('takes one valid assignment and reports later assignments', () => {
    const r = make();

    expect(r.coordinator.accept({ defaultLanguage: 'hu' })).toBe(true);
    expect(r.coordinator.accept({ defaultLanguage: 'en' })).toBe(false);

    expect(r.coordinator.config).toEqual({ defaultLanguage: 'hu' });
    expect(r.error).toHaveBeenCalledWith(expect.stringContaining('editor is already configured'));
  });

  it('does not spend the claim on unusable configuration', () => {
    const r = make();

    expect(r.coordinator.accept(null as unknown as CeeConfig)).toBe(false);
    expect(r.coordinator.accept({ defaultLanguage: 'hu' })).toBe(true);
  });

  it('reloads already-active languages when their source changes', () => {
    const r = make(['en', 'hu']);
    expect(r.coordinator.accept({ languageMapPathPrefix: '/maps/' })).toBe(true);

    r.coordinator.apply(r.context());

    expect(r.globals.languageMapPathPrefix).toBe('/maps/');
    expect(r.getTranslation).toHaveBeenCalledWith('en');
    expect(r.getTranslation).toHaveBeenCalledWith('hu');
    // Each language's new map replaces the old one in one write, so it is announced once.
    expect(r.setTranslation.mock.calls).toEqual([
      ['en', { Generic: { ExpandAll: 'Expand en' } }],
      ['hu', { Generic: { ExpandAll: 'Expand hu' } }],
    ]);
    // Neither path that forgets the stored map first is taken: from ngx-translate 18.1
    // forgetting it announces an empty map, which every rendered label would read.
    expect(r.reloadLang).not.toHaveBeenCalled();
    expect(r.deleteLanguage).not.toHaveBeenCalled();
  });

  it('leaves the stored maps alone when the source does not move', () => {
    const r = make(['en']);

    r.coordinator.apply(r.context());

    expect(r.getTranslation).not.toHaveBeenCalled();
    expect(r.setTranslation).not.toHaveBeenCalled();
  });
});
