import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { JsonSchema } from '../models/json-schema.model';
import { PmidSearchResponse } from '../models/rest/pmid-search/pmid-search-response';
import { PmidDetailResponse } from '../models/rest/pmid-detail/pmid-detail-response';
import { PmidSearchResponseItem } from '../models/rest/pmid-search/pmid-search-response-item';

@Injectable({
  providedIn: 'root',
})
export class PmidFieldDataService {
  private pmidSearchUrl;
  private pmidDetailsUrl;

  constructor(private http: HttpClient) {}

  setPmidSearchUrl(pmidSearchUrl: string) {
    this.pmidSearchUrl = pmidSearchUrl;
  }
  setPmidDetailsUrl(pmidDetailsUrl: string) {
    this.pmidDetailsUrl = pmidDetailsUrl;
  }
  getData(val: string): Observable<PmidSearchResponse> {
    const params = new HttpParams().set('q', val);
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<PmidSearchResponse>(this.pmidSearchUrl, { params }).pipe(
          map((response) => {
            const results: PmidSearchResponseItem[] = Object.keys(response.results).map((key) => ({
              [JsonSchema.atId]: key,
              [JsonSchema.rdfsLabel]: response.results[key].name,
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
  getDetails(id: string): Observable<PmidDetailResponse> {
    const encodedId = encodeURIComponent(id);
    return this.http.get<PmidDetailResponse>(`${this.pmidDetailsUrl}/${encodedId}`, {});
  }
}
