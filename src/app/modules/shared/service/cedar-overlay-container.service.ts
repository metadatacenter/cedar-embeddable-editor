import { DOCUMENT } from '@angular/common';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Platform } from '@angular/cdk/platform';
import { ElementRef, Inject, Injectable } from '@angular/core';

/** Keeps Angular Material overlays inside the editor's style boundary. */
@Injectable()
export class CedarOverlayContainer extends OverlayContainer {
  constructor(
    @Inject(DOCUMENT) document: Document,
    platform: Platform,
    private readonly editorElement: ElementRef<HTMLElement>,
  ) {
    super(document, platform);
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
  }
}
