import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * Render HTML that came from **data**, with Angular's sanitizer doing its job.
 *
 * The counterpart to `keepHtml`, and the distinction between them is a trust
 * boundary rather than a preference:
 *
 * - `keepHtml` (`EscapeHtmlPipe`) calls `bypassSecurityTrustHtml` and is for content
 *   a *template author* wrote — `cedar-static-rich-text`'s body, which exists to be
 *   formatted and whose author is already trusted with the form's structure.
 * - this one is for anything that came out of an **instance**: a field's value, or a
 *   pager label built from values. Those arrive with whatever document the host page
 *   loaded, and CEE is a component embedded in someone else's page, so treating them
 *   as trusted markup hands an instance author script execution in that page's origin.
 *
 * `sanitize` is not `escape`: safe formatting survives, so a value containing
 * `<b>` still renders bold. What does not survive is script, event-handler
 * attributes, `javascript:` URLs and the rest of what the sanitizer strips — which
 * is the entire difference that matters here.
 *
 * Covered by `markup in an instance value` in the visual suite, which asserts a
 * neutralised handler and surviving formatting in the same value.
 */
@Pipe({ name: 'safeHtml', pure: false })
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(content: string): string {
    if (content === null || content === undefined) {
      return '';
    }
    // Returns the sanitized markup as a plain string, which `[innerHTML]` then
    // treats as untrusted and passes through its own sanitization — belt and
    // braces, and it keeps this pipe's output inspectable in a test.
    return this.sanitizer.sanitize(SecurityContext.HTML, content) ?? '';
  }
}
