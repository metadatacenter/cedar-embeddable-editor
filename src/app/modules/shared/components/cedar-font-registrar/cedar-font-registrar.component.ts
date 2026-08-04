import { Component, ViewEncapsulation } from '@angular/core';

/**
 * Registers CEE's embedded fonts in the document font set.
 *
 * Browsers do not register @font-face declarations from a shadow root. This is
 * the only deliberately unencapsulated CEE component, and its stylesheet
 * contains no selectors: only CEE-namespaced @font-face declarations.
 */
@Component({
  selector: 'app-cedar-font-registrar',
  template: '',
  styleUrls: ['./cedar-font-registrar.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarFontRegistrarComponent {}
