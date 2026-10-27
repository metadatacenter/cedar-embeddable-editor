import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The host-fonts bundle's registrar, which registers no fonts.
 *
 * A host that loads this bundle registers CEDAR Roboto 400 and 500 for its whole page, and CEE draws
 * its icons as SVG, so there is nothing for CEE to add.
 */
@Component({
  selector: 'app-cedar-font-registrar',
  template: '',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarFontRegistrarComponent {}
