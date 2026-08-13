import { Injectable } from '@angular/core';

/**
 * Whether this editor trusts its template's markup to render verbatim.
 *
 * False unless the embedding page says otherwise, because the safe answer has to
 * be the one a host gets by doing nothing. A host that loads templates its own
 * users chose — from CEDAR's library, say — is trusting "allowed to define a form"
 * as though it were "allowed to run JavaScript in this origin", and those are not
 * the same credential.
 *
 * Set from the `trustTemplateMarkup` configuration key. Held in a service rather
 * than passed down, because the one consumer is a pipe eleven levels below the
 * component that reads the configuration.
 */
@Injectable({
  providedIn: 'root',
})
export class TemplateTrustService {
  private _trustTemplateMarkup = false;

  get trustTemplateMarkup(): boolean {
    return this._trustTemplateMarkup;
  }

  setTrustTemplateMarkup(value: boolean): void {
    this._trustTemplateMarkup = value;
  }
}
