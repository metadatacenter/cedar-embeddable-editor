import { vi } from 'vitest';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
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
  const setDefaultLang = vi.fn();
  const use = vi.fn();
  const reloadLang = vi.fn(() => of({ Generic: { ExpandAll: 'Expand' } }));
  const setTranslation = vi.fn();
  const globals = { languageMapPathPrefix: null } as GlobalSettingsContextService;
  const coordinator = new WrapperConfigCoordinator(
    { setIntegratedSearchUrl } as unknown as ControlledFieldDataService,
    { error, trace, traceGroup } as unknown as MessageHandlerService,
    { getLangs: () => loaded, setDefaultLang, use, reloadLang, setTranslation } as unknown as TranslateService,
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
    setDefaultLang,
    use,
    reloadLang,
    setTranslation,
  };
};

describe('WrapperConfigCoordinator', () => {
  it('applies documented defaults when the host supplies no config', () => {
    const r = make();
    const context = r.context();

    r.coordinator.apply(context);

    expect(r.setDefaultLang).toHaveBeenCalledWith('en');
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
    expect(r.setDefaultLang).toHaveBeenLastCalledWith('fr');
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
    expect(r.reloadLang).toHaveBeenCalledTimes(2);
    expect(r.setTranslation).toHaveBeenCalledWith('en', { Generic: { ExpandAll: 'Expand' } });
    expect(r.setTranslation).toHaveBeenCalledWith('hu', { Generic: { ExpandAll: 'Expand' } });
  });
});
