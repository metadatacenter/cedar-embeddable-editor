import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Render HTML verbatim, with Angular's sanitizer switched off.
 *
 * The counterpart to `safeHtml`, and the choice between the two is a trust boundary
 * rather than a preference. This one is for markup a *template author* wrote. Anything
 * that came out of an **instance** uses `safeHtml`, which sanitizes: an instance arrives
 * with whatever document the host page loaded, and CEE renders inside someone else's
 * page, so trusting it hands an instance author script execution in that origin.
 *
 * One caller qualifies, the body of `cedar-static-rich-text`, a field whose whole
 * purpose is to carry formatting its author composed. Sanitizing it would not harden
 * the field, it would break it: Angular's allowlist has no `style` attribute and no
 * `iframe`, while the rich-text editor in `cedar-template-editor` emits inline styles
 * for color, size and table formatting. That formatting would silently disappear.
 *
 * Trusting the template rests on an assumption the embedding application has to satisfy.
 * The host page decides which template loads, so a template is as trusted as the host's
 * own configuration. A host that instead lets end users pick an arbitrary template from
 * CEDAR breaks that assumption, because "allowed to define the form" is a much weaker
 * credential than "allowed to run JavaScript in the host origin". Such a host wants
 * sanitization here, and wants it from a sanitizer that keeps inline styles rather than
 * Angular's, so that the feature survives the fix.
 *
 * Covered by `markup in an instance value` in the visual suite, which asserts the
 * boundary from the other side: a handler in an instance value is neutralized while
 * safe formatting survives.
 */
@Pipe({ name: 'keepHtml', pure: false })
export class TrustHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(content: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(content);
  }
}
