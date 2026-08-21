import { Injectable } from '@angular/core';
import { EMPTY, Observable, timer } from 'rxjs';
import { IntegratedSearchResponse } from '../models/rest/integrated-search/integrated-search-response';
import { IntegratedSearchRequest } from '../models/rest/integrated-search/integrated-search-request';
import { FieldComponent } from '../models/component/field-component.model';
import { AuthorityTerm } from '../models/authority/authority-search-response.model';
import { HttpClient } from '@angular/common/http';
import { MessageHandlerService } from './message-handler.service';
import { map, switchMap } from 'rxjs/operators';

/**
 * The terminology server's search route, under whatever base a host names.
 *
 * CEE's, in the way the authority descriptors' paths are: it is how the
 * terminology server is addressed, and a host free to move it could only move it
 * somewhere nothing answers. It reached CEE inside `terminologyIntegratedSearchUrl`
 * for as long as that key took the endpoint whole, which put this string in four
 * deployment configs.
 */
export const INTEGRATED_SEARCH_PATH = 'bioportal/integrated-search';

@Injectable({
  providedIn: 'root',
})
export class ControlledFieldDataService {
  private integratedSearchUrl: string | null = null;
  private reportedUnconfigured = false;

  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
  ) {}

  setIntegratedSearchUrl(integratedSearchUrl: string): void {
    this.integratedSearchUrl = integratedSearchUrl;
  }

  /**
   * The terms the terminology server offers for what the user typed.
   *
   * The conversion from the server's document happens here rather than in the
   * widget, which is the boundary CEE's model of a term stops at: past this
   * point a result is an `AuthorityTerm`, the same as one from ORCID or ROR, and
   * nothing knows how the terminology server spelled its keys.
   */
  getData(val: string, component: FieldComponent): Observable<AuthorityTerm[]> {
    const postData = new IntegratedSearchRequest();
    postData.parameterObject.inputText = val;
    postData.parameterObject.valueConstraints.branches = component.controlledInfo.branches;
    postData.parameterObject.valueConstraints.classes = component.controlledInfo.classes;
    postData.parameterObject.valueConstraints.ontologies = component.controlledInfo.ontologies;
    postData.parameterObject.valueConstraints.valueSets = component.controlledInfo.valueSets;
    // Random delay to prevent throttling
    const searchUrl = this.integratedSearchUrl;
    if (searchUrl === null) {
      // No endpoint configured, so no terms to offer. The autocomplete shows its
      // "no results" row, which is what an empty response produces anyway — and
      // that is indistinguishable from a term nobody has, so say once which key
      // is missing rather than let a host watch a working field find nothing.
      this.reportUnconfigured();
      return EMPTY;
    }
    const randomDelay = Math.floor(Math.random() * 2000);
    return timer(randomDelay).pipe(
      switchMap(() => this.http.post<IntegratedSearchResponse>(searchUrl, postData)),
      map((response) => this.toTerms(response, val)),
    );
  }

  /**
   * Say once that controlled-term search is off, and why.
   *
   * Once per editor, not once per keystroke: a form of controlled fields would
   * otherwise report this on every character typed into any of them.
   */
  private reportUnconfigured(): void {
    if (this.reportedUnconfigured) {
      return;
    }
    this.reportedUnconfigured = true;
    this.messageHandlerService.error(
      'CEDAR Embeddable Editor: controlled-term search is off, because "terminologyBaseUrl" is not configured. ' +
        'Set it to the CEDAR terminology server, ending in a slash.',
    );
  }

  /**
   * The results, or an empty list and a report of what came back instead.
   *
   * The endpoint answers an error with a payload carrying no collection at all,
   * which is why the check is for the property rather than for its length. The
   * widget used to make it, and reported the same way.
   */
  private toTerms(response: IntegratedSearchResponse | null, query: string): AuthorityTerm[] {
    if (response == null) {
      return [];
    }
    if (!Array.isArray(response.collection)) {
      this.messageHandlerService.errorObject(query || 'empty string', response);
      return [];
    }
    return response.collection.map((item) => ({ iri: item['@id'], label: item.prefLabel ?? '' }));
  }
}
