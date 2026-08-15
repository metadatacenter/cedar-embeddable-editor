import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { InputType } from '../models/input-type.model';
import {
  AuthorityDetailResponse,
  AuthoritySearchResponse,
  AuthorityTerm,
} from '../models/authority/authority-search-response.model';
import { MessageHandlerService } from './message-handler.service';

/** Where one authority's two endpoints live. Set from the host page's config. */
interface AuthorityEndpoints {
  searchUrl: string;
  detailsUrl: string;
}

/**
 * What an authority's search endpoint answers with, before it becomes terms.
 *
 * `results` is a map keyed by IRI, whose values carry a name. Every field is
 * optional because the document is the authority's; the shape is not.
 *
 * A second form was declared here — a list of terms already — and read by
 * `toItems`. It was never a wire shape. The seven services this replaced each
 * converted the map and nothing else, and the array guard came from the widget
 * one layer downstream, where `resp.results` was the *service's own output*: an
 * array, because the service had just built one with `Object.keys(...).map(...)`.
 * Reading that guard as evidence about the endpoint turned a defence against
 * CEE's own upstream into a claim about an authority, and typing it meant
 * inventing the keys such a term would carry — `@id` and `rdfs:label`, copied
 * from the converter rather than observed on any wire.
 */
interface AuthoritySearchPayload {
  found?: boolean;
  results?: Record<string, { name?: string; details?: string } | null | undefined> | null;
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
  private reportedUnconfigured = false;

  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
  ) {}

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
    if (url === null) {
      return EMPTY;
    }
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
    if (url === null) {
      return EMPTY;
    }
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
    // A response that is not the map this describes yields no terms. The
    // autocomplete shows its "no results" row, and a lookup that *failed* is
    // already told apart from one that found nothing — the widgets record that
    // separately, so an empty list here does not have to carry both meanings.
    if (Array.isArray(results) || typeof results !== 'object') {
      return [];
    }
    return Object.keys(results).map((key) => ({
      iri: key,
      label: results[key]?.name ?? '',
      detailsUrl: results[key]?.details,
    }));
  }

  private searchUrlFor(inputType: InputType): string | null {
    return this.endpointsFor(inputType)?.searchUrl ?? null;
  }

  private detailsUrlFor(inputType: InputType): string | null {
    return this.endpointsFor(inputType)?.detailsUrl ?? null;
  }

  /**
   * One authority's endpoints, or nothing when the host named no bridge server.
   *
   * This threw, which was right while the base URL had a default: endpoints
   * were always registered, so their absence could only mean a widget had asked
   * for an input type that is not an authority. With no default the same absence
   * is the ordinary case of a host that did not configure the lookups, and an
   * exception per keystroke is not how CEE reports a missing key — the
   * controlled-term search has answered the same situation with no terms and one
   * message all along.
   */
  private endpointsFor(inputType: InputType): AuthorityEndpoints | null {
    const found = this.endpoints.get(inputType);
    if (!found) {
      this.reportUnconfigured(inputType);
      return null;
    }
    return found;
  }

  /** Say once that the authority lookups are off, and why. */
  private reportUnconfigured(inputType: InputType): void {
    if (this.reportedUnconfigured) {
      return;
    }
    this.reportedUnconfigured = true;
    this.messageHandlerService.error(
      `CEDAR Embeddable Editor: external authority lookups are off, so the "${inputType}" field offers no terms, ` +
        'because "bridgeBaseUrl" is not configured. Set it to the CEDAR bridge server, ending in a slash.',
    );
  }
}
