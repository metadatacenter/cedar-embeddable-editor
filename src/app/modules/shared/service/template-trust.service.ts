import { Injectable } from '@angular/core';

/**
 * Whether this editor trusts its template's rich text to render verbatim.
 *
 * False unless the embedding page says otherwise, because the safe answer has to
 * be the one a host gets by doing nothing. A host that loads templates its own
 * users chose — from CEDAR's library, say — is trusting "allowed to define a form"
 * as though it were "allowed to run JavaScript in this origin", and those are not
 * the same credential.
 *
 * Set from the `trustTemplateRichText` configuration key, which names the one surface
 * it governs: the body of a static rich-text field, the only template-authored content
 * CEE renders as HTML. Held in a service rather
 * than passed down, because the one consumer is a pipe eleven levels below the
 * component that reads the configuration.
 */
@Injectable({
  providedIn: 'root',
})
export class TemplateTrustService {
  private _trustTemplateRichText = false;

  get trustTemplateRichText(): boolean {
    return this._trustTemplateRichText;
  }

  setTrustTemplateRichText(value: boolean): void {
    this._trustTemplateRichText = value;
  }
}
