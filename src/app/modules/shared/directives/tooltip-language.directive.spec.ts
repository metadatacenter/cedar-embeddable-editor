// @vitest-environment jsdom
import { Injector, runInInjectionContext } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { CedarTooltipLanguageDirective } from './tooltip-language.directive';

describe('CedarTooltipLanguageDirective', () => {
  /** A tooltip as Material leaves it: with no overlay before it first shows, and with one after. */
  const directiveFor = (pane: HTMLElement | null, language: string | null) => {
    const tooltip = { _overlayRef: pane === null ? null : { overlayElement: pane } } as unknown as MatTooltip;
    const injector = Injector.create({ providers: [{ provide: MatTooltip, useValue: tooltip }] });
    const directive = runInInjectionContext(injector, () => new CedarTooltipLanguageDirective());
    directive.cedarTooltipLanguage = language;
    return directive;
  };

  it("marks the tooltip's pane with the template's language once Material has made it", () => {
    const pane = document.createElement('div');

    directiveFor(pane, 'fr').ngDoCheck();

    expect(pane.getAttribute('lang')).toBe('fr');
  });

  it("leaves the pane unmarked where the template declares no language, so it takes CEE's", () => {
    const pane = document.createElement('div');

    directiveFor(pane, null).ngDoCheck();

    expect(pane.hasAttribute('lang')).toBe(false);
  });

  it('writes the mark only when it changes, so a check that finds it in place touches nothing', () => {
    const pane = document.createElement('div');
    const directive = directiveFor(pane, 'fr');
    directive.ngDoCheck();
    const written: MutationRecord[] = [];
    const observer = new MutationObserver((records) => written.push(...records));
    observer.observe(pane, { attributes: true });

    directive.ngDoCheck();

    expect(observer.takeRecords().concat(written)).toEqual([]);
    observer.disconnect();
  });

  it('does nothing before the tooltip first shows', () => {
    expect(() => directiveFor(null, 'fr').ngDoCheck()).not.toThrow();
  });
});
