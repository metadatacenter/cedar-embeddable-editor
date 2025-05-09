import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { OrcidSearchResponse } from '../models/rest/orcid-search/orcid-search-response';
import { OrcidSearchResponseItem } from '../models/rest/orcid-search/orcid-search-response-item';
import { JsonSchema } from '../models/json-schema.model';

@Injectable({
  providedIn: 'root',
})
export class OrcidFieldDataService {
  private orcidSearchUrl;
  private orcidDetailsUrl;

  constructor(private http: HttpClient) {}
  setOrcidSearchUrl(orcidSearchUrl: string): void {
    this.orcidSearchUrl = orcidSearchUrl;
  }
  setOrcidDetailsUrl(orcidDetailsUrl: string): void {
    this.orcidDetailsUrl = orcidDetailsUrl;
  }
  getData(val: string): Observable<OrcidSearchResponse> {
    const params = new HttpParams().set('q', val);
    // Random delay to prevent throttling
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<OrcidSearchResponse>(this.orcidSearchUrl, { params }).pipe(
          map((response) => {
            const results: OrcidSearchResponseItem[] = Object.keys(response.results).map((key) => ({
              [JsonSchema.atId]: key,
              [JsonSchema.rdfsLabel]: response.results[key].name,
              _details: response.results[key].details,
            }));
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
    const encodedId = encodeURIComponent(id);
    return this.http.get<OrcidSearchResponseItem>(`${this.orcidDetailsUrl}/${encodedId}`, {});
  }
}
