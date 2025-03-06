import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { OrcidSearchResponse } from '../models/rest/orcid-search/orcid-search-response';
import { OrcidSearchResponseItem } from '../models/rest/orcid-search/orcid-search-response-item';

@Injectable({
  providedIn: 'root',
})
export class OrcidFieldDataService {
  private orcidSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/orcid/search-by-name';
  private orcidDetailsUrl = 'https://bridge.metadatacenter.orgx/ext-auth/orcid';

  constructor(private http: HttpClient) {}

  // setRorSearchUrl(rorSearchUrl: string): void {
  setOrcidSearchUrl(): void {
    // this.terminologyIntegratedSearchUrl = terminologyIntegratedSearchUrl;
    this.orcidSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/orcid/search-by-name';
  }

  getData(val: string): Observable<OrcidSearchResponse> {
    const params = new HttpParams().set('q', encodeURI(val));
    // Random delay to prevent throttling
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<OrcidSearchResponse>(this.orcidSearchUrl, { params }).pipe(
          map((response) => {
            console.log('Orcid response', response);
            const results: OrcidSearchResponseItem[] = Object.keys(response.results).map((key) => ({
              id: key,
              rdfsLabel: response.results[key],
            }));
            // Return the response matching the OrcidSearchResponse interface
            return {
              found: response.found,
              results: results,
            };
          }),
        ),
      ),
    );
  }

  getDetails(id: string): Observable<any> {
    console.log('id', id);
    console.log('id', id);
    const encodedId = encodeURIComponent(id);
    const result = this.http.get<any>(`${this.orcidDetailsUrl}/${encodedId}`, {});
    console.log('Details Orcid', result.subscribe());
    return result;
  }
}
