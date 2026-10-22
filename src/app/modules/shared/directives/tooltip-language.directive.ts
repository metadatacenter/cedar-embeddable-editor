import { Directive, DoCheck, Input, inject } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { markLanguage } from '../a11y/language-tag';

/**
 * Marks a tooltip with the language of the text it shows, where that is the template's.
 *
 * Material draws a tooltip in the overlay container, which carries CEE's language, and gives the
 * tooltip no input that reaches the element it draws. A description tooltip shows the template's
 * text, so its pane is marked with the language the template declares, once Material has made the
 * pane and on every later check. Where the template declares none, the pane states none and takes
 * CEE's language from the container.
 */
@Directive({ selector: '[matTooltip][cedarTooltipLanguage]', standalone: true })
export class CedarTooltipLanguageDirective implements DoCheck {
  private readonly tooltip = inject(MatTooltip);

  /** The language of the tooltip's text, as a `lang` tag, or null where the template declares none. */
  @Input() cedarTooltipLanguage: string | null = null;

  ngDoCheck(): void {
    const pane = this.tooltip._overlayRef?.overlayElement;
    if (pane && pane.getAttribute('lang') !== this.cedarTooltipLanguage) {
      markLanguage(pane, this.cedarTooltipLanguage);
    }
  }
}
