import { OverlayContainer } from '@angular/cdk/overlay';
import { ElementRef, Injectable, OnDestroy, Optional } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { merge, Subscription } from 'rxjs';
import { markLanguage, uiLanguageOf } from '../util/language-tag';
import { GlobalSettingsContextService } from './global-settings-context.service';

/** Keeps Angular Material overlays inside the editor's style boundary. */
@Injectable()
export class CedarOverlayContainer extends OverlayContainer implements OnDestroy {
  private readonly languageChanges: Subscription | undefined;

  /*
   * The document and platform used to arrive as constructor parameters and be
   * handed up to `super`. From CDK 22 `OverlayContainer` declares no constructor
   * at all and resolves them itself through `inject()`, so passing them is an
   * error rather than a redundancy. `this._document` below is unaffected — the
   * base class still exposes it, it is simply no longer this class's job to
   * supply it.
   */
  constructor(
    private readonly editorElement: ElementRef<HTMLElement>,
    @Optional() private readonly translate: TranslateService | null = null,
    @Optional() private readonly globals: GlobalSettingsContextService | null = null,
  ) {
    super();
    // The container sits beside the element's root rather than inside it, so it states the language itself.
    this.languageChanges = translate
      ? merge(translate.onLangChange, translate.onTranslationChange).subscribe(() => this.markLanguage())
      : undefined;
  }

  override ngOnDestroy(): void {
    this.languageChanges?.unsubscribe();
    super.ngOnDestroy();
  }

  protected override _createContainer(): void {
    const shadowRoot = this.editorElement.nativeElement.shadowRoot;
    if (shadowRoot === null) {
      throw new Error('CEE overlay container requires the editor shadow root');
    }

    const container = this._document.createElement('div');
    container.classList.add('cdk-overlay-container', 'cee-overlay-container');
    shadowRoot.appendChild(container);
    this._containerElement = container;
    this.markLanguage();
  }

  private markLanguage(): void {
    if (this._containerElement && this.translate && this.globals) {
      markLanguage(this._containerElement, uiLanguageOf(this.translate, this.globals));
    }
  }
}
