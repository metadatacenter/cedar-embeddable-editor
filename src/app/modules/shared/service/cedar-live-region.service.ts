import { ElementRef, Injectable, OnDestroy, Optional } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { merge, Subscription } from 'rxjs';
import { markLanguage, uiLanguageOf } from '../util/language-tag';
import { GlobalSettingsContextService } from './global-settings-context.service';

/**
 * The live region CDK's `LiveAnnouncer` speaks through, inside the element's shadow root.
 *
 * The announcer's own region is appended to the page's `body`, outside the boundary CEE renders
 * in and without its language. Each editor and field element provides one of these and a
 * `LiveAnnouncer` of its own, so what it announces stays with it.
 */
@Injectable()
export class CedarLiveRegion implements OnDestroy {
  readonly element: HTMLElement | null;
  private readonly languageChanges: Subscription | undefined;

  constructor(
    wrapper: ElementRef<HTMLElement>,
    @Optional() translate: TranslateService | null = null,
    @Optional() globals: GlobalSettingsContextService | null = null,
  ) {
    const shadowRoot = wrapper.nativeElement.shadowRoot;
    this.element = shadowRoot === null ? null : wrapper.nativeElement.ownerDocument.createElement('div');
    if (shadowRoot === null || this.element === null) {
      return;
    }
    const region = this.element;
    region.classList.add('cee-live-region', 'cdk-visually-hidden');
    region.setAttribute('aria-atomic', 'true');
    region.setAttribute('aria-live', 'polite');
    shadowRoot.appendChild(region);
    if (translate && globals) {
      const mark = (): void => markLanguage(region, uiLanguageOf(translate, globals));
      mark();
      this.languageChanges = merge(translate.onLangChange, translate.onTranslationChange).subscribe(mark);
    }
  }

  ngOnDestroy(): void {
    this.languageChanges?.unsubscribe();
    this.element?.remove();
  }
}
