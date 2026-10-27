import { CSP_NONCE, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { registerFontFaces } from '@org.metadatacenter/cedar-design-tokens/font-faces';

/**
 * Registers CEE's embedded fonts in the document font set.
 *
 * Browsers register an @font-face only from the document, never from a shadow root, so the faces go
 * into the document's head, once for every CEDAR component on the page. Declared as the styles of an
 * unencapsulated component, as they were, Angular also copied them into every shadow root, where
 * nothing reads them: 122 kB a root.
 */
@Component({
  selector: 'app-cedar-font-registrar',
  template: '',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFontRegistrarComponent {
  constructor() {
    registerFontFaces(inject(DOCUMENT), inject(CSP_NONCE, { optional: true }));
  }
}
