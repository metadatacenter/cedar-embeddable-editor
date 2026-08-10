import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { InputType } from '../models/input-type.model';
import {
  AuthorityDetailResponse,
  AuthoritySearchResponse,
  AuthorityTerm,
} from '../models/authority/authority-search-response.model';

/** Where one authority's two endpoints live. Set from the host page's config. */
interface AuthorityEndpoints {
  searchUrl: string;
  detailsUrl: string;
}

/**
 * A term as an authority writes one, for the endpoints that answer with a list.
 *
 * The one place in CEE that names a JSON-LD key on purpose, and it names it as
 * the wire format it is rather than through the model library's constants: this
 * is what an authority sends, and CEDAR's serialization has no say in it. The
 * conversion below is the boundary — past it, a term is an `AuthorityTerm` with
 * named properties and nothing knows how the authority spelled them.
 *
 * Every property optional because the shape is the authority's to decide.
 */
interface AuthorityWireTerm {
  '@id'?: string;
  'rdfs:label'?: string;
  _details?: string;
}

/**
 * What an authority's search endpoint answers with, before it becomes terms.
 *
 * Every field optional, and `results` in either of the two shapes seen in the
 * wild: an object keyed by IRI, or a list of terms already. This is the raw
 * document, not CEE's model of it — `toItems` is the conversion, and holding the
 * payload as `any` was what let that function read whatever it liked.
 */
interface AuthoritySearchPayload {
  found?: boolean;
  results?: Record<string, { name?: string; details?: string } | null | undefined> | AuthorityWireTerm[] | null;
}

/**
 * Search and resolve against any external authority.
 *
 * Replaces seven services — ORCID, ROR, PFAS, PubMed, RRID, NIH Grant, DOI —
 * which were identical apart from their type names, their two URL fields, and
 * ORCID additionally copying a `_details` link off each result. 347 lines
 * saying one thing seven times.
 *
 * The endpoints are held per input type rather than as fields per authority,
 * because that is what made seven services necessary in the first place: each
 * had its own `setXSearchUrl`/`setXDetailsUrl` pair, so adding an eighth
 * authority meant a new service, a new pair of setters, and a new line in the
 * editor component's config reader.
 */
@Injectable({
  providedIn: 'root',
})
export class ExternalAuthorityLookupService {
  private endpoints = new Map<InputType, AuthorityEndpoints>();

  constructor(private http: HttpClient) {}

  setEndpoints(inputType: InputType, searchUrl: string, detailsUrl: string): void {
    this.endpoints.set(inputType, { searchUrl, detailsUrl });
  }

  /**
   * Search the authority by name.
   *
   * The random delay is transcribed from the services this replaces, where it
   * was commented "prevent throttling" in the ORCID one and left unexplained in
   * the other six. It staggers the requests a form full of authority fields
   * fires at once.
   */
  search(inputType: InputType, query: string): Observable<AuthoritySearchResponse> {
    const url = this.searchUrlFor(inputType);
    const params = new HttpParams().set('q', query);
    const randomDelay = Math.floor(Math.random() * 500);

    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<AuthoritySearchPayload>(url, { params }).pipe(
          map((response) => ({
            found: response?.found,
            results: ExternalAuthorityLookupService.toItems(response),
          })),
        ),
      ),
    );
  }

  /**
   * Resolve a single identifier to its term.
   *
   * Generic in the document returned. Five authorities answer with
   * `AuthorityDetailResponse` — `{found, name, id}` and nothing more, which is
   * the default. ORCID answers with a researcher record and ROR with an
   * organisation record, and each of those two renders a panel from it, so they
   * name their own type here rather than casting at the call site.
   */
  resolve<T = AuthorityDetailResponse>(inputType: InputType, id: string): Observable<T> {
    const url = this.detailsUrlFor(inputType);
    return this.http.get<T>(`${url}/${encodeURIComponent(id)}`, {});
  }

  /**
   * Turn the authority's response into terms.
   *
   * Every one of the seven services did this identically: the response's
   * `results` is an object keyed by IRI, whose values carry a `name`. ORCID also
   * copied a `details` link through, which is harmless for the others and is
   * kept for all of them rather than special-cased — a `detailsUrl` nobody reads
   * costs nothing, and a branch on input type here would be the first crack in
   * the thing being removed.
   */
  private static toItems(response: AuthoritySearchPayload | null): AuthorityTerm[] {
    const results = response?.results;
    if (results === null || results === undefined) {
      return [];
    }
    // Already a list of terms: some endpoints answer that way, and the widgets
    // all guarded for it before passing results on. Read through `AuthorityWireTerm`
    // rather than passed along, because a wire term and CEE's term no longer share
    // a shape — the object form below never did.
    if (Array.isArray(results)) {
      return results.map((term) => ({
        iri: term['@id'] ?? '',
        label: term['rdfs:label'] ?? '',
        detailsUrl: term._details,
      }));
    }
    return Object.keys(results).map((key) => ({
      iri: key,
      label: results[key]?.name ?? '',
      detailsUrl: results[key]?.details,
    }));
  }

  private searchUrlFor(inputType: InputType): string {
    return this.endpointsFor(inputType).searchUrl;
  }

  private detailsUrlFor(inputType: InputType): string {
    return this.endpointsFor(inputType).detailsUrl;
  }

  private endpointsFor(inputType: InputType): AuthorityEndpoints {
    const found = this.endpoints.get(inputType);
    if (!found) {
      // A widget rendering with no endpoints is a configuration mistake, and it
      // used to surface as a request to `undefined`. Naming the type is more use
      // than a 404.
      throw new Error(`No external authority endpoints configured for input type "${inputType}"`);
    }
    return found;
  }
}
