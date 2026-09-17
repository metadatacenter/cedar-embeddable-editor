import { Component, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';

/**
 * Registers only CEE's icon font; the host supplies CEE Roboto 400 and 500.
 *
 * Browsers do not register @font-face declarations from a shadow root. This is
 * the only deliberately unencapsulated CEE component, and its stylesheet
 * contains no selectors: only CEE-namespaced @font-face declarations.
 */
@Component({
  selector: 'app-cedar-font-registrar',
  template: '',
  styleUrls: ['./cedar-font-registrar.host-fonts.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFontRegistrarComponent {}
