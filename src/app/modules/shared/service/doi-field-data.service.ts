import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { JsonSchema } from '../models/json-schema.model';
import { DoiSearchResponse } from '../models/rest/doi-search/doi-search-response';
import { DoiDetailResponse } from '../models/rest/doi-detail/doi-detail-response';
import { DoiSearchResponseItem } from '../models/rest/doi-search/doi-search-response-item';

@Injectable({
  providedIn: 'root',
})
export class DoiFieldDataService {
  private doiSearchUrl;
  private doiDetailsUrl;

  constructor(private http: HttpClient) {}

  setDoiSearchUrl(doiSearchUrl: string) {
    this.doiSearchUrl = doiSearchUrl;
  }
  setDoiDetailsUrl(doiDetailsUrl: string) {
    this.doiDetailsUrl = doiDetailsUrl;
  }
  getData(val: string): Observable<DoiSearchResponse> {
    const params = new HttpParams().set('q', val);
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<DoiSearchResponse>(this.doiSearchUrl, { params }).pipe(
          map((response) => {
            const results: DoiSearchResponseItem[] = Object.keys(response.results).map((key) => ({
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
  getDetails(id: string): Observable<DoiDetailResponse> {
    const encodedId = encodeURIComponent(id);
    return this.http.get<DoiDetailResponse>(`${this.doiDetailsUrl}/${encodedId}`, {});
  }
}
