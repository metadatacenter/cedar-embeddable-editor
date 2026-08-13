import { OverlayContainer } from '@angular/cdk/overlay';
import { ElementRef, Injectable } from '@angular/core';

/** Keeps Angular Material overlays inside the editor's style boundary. */
@Injectable()
export class CedarOverlayContainer extends OverlayContainer {
  /*
   * The document and platform used to arrive as constructor parameters and be
   * handed up to `super`. From CDK 22 `OverlayContainer` declares no constructor
   * at all and resolves them itself through `inject()`, so passing them is an
   * error rather than a redundancy. `this._document` below is unaffected — the
   * base class still exposes it, it is simply no longer this class's job to
   * supply it.
   */
  constructor(private readonly editorElement: ElementRef<HTMLElement>) {
    super();
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
