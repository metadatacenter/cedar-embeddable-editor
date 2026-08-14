import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TemplateTrustService } from '../service/template-trust.service';
import { sanitizeTemplateMarkup } from '../util/template-markup-policy';

/**
 * Render a template author's rich text.
 *
 * The counterpart to `safeHtml`, and the choice between the two is a trust boundary
 * rather than a preference. This one is for markup a *template author* wrote. Anything
 * that came out of an **instance** uses `safeHtml`, which sanitizes: an instance arrives
 * with whatever document the host page loaded, and CEE renders inside someone else's
 * page, so trusting it hands an instance author script execution in that origin.
 *
 * One caller qualifies, the body of `cedar-static-rich-text`, a field whose whole
 * purpose is to carry formatting its author composed.
 *
 * This used to call `bypassSecurityTrustHtml` unconditionally, which made every
 * embedder's security depend on a property none of them were told about: that the
 * host, not its users, decides which template loads. A host that lets end users pick
 * a template from CEDAR's library breaks that assumption, because "allowed to define
 * the form" is a much weaker credential than "allowed to run JavaScript in the host
 * origin". Nothing in the README said so.
 *
 * So the default is now to sanitize, through `sanitizeTemplateMarkup` rather than
 * Angular's sanitizer — Angular's allowlist has no `style` attribute, and 99 of the
 * corpus's 271 static content blocks carry one, so using it would silently flatten
 * the colours, sizes and margins the field exists to show. Verbatim rendering is
 * still available, but only to a host that asks for it by name, through the
 * `trustTemplateRichText` configuration key.
 *
 * Covered from both sides in the visual suite: `template rich text` asserts that a
 * malicious template cannot execute under the default and that supported formatting
 * survives it, and `markup in an instance value` asserts the same boundary for
 * instance-authored content.
 */
@Pipe({
  name: 'keepHtml',
  pure: false,
  standalone: false,
})
export class TrustHtmlPipe implements PipeTransform {
  constructor(
    private sanitizer: DomSanitizer,
    private templateTrust: TemplateTrustService,
  ) {}

  transform(content: string): SafeHtml {
    if (this.templateTrust.trustTemplateRichText) {
      return this.sanitizer.bypassSecurityTrustHtml(content);
    }
    /*
     * Marked trusted *after* being sanitized, which reads oddly and is deliberate.
     * The markup has been through the policy already; handing the result back to
     * Angular's sanitizer would strip the `style` attributes the policy exists to
     * keep, so the bypass here says "already checked, by something stricter about
     * scripts and looser about formatting" rather than "unchecked".
     */
    return this.sanitizer.bypassSecurityTrustHtml(sanitizeTemplateMarkup(content));
  }
}
