import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { RridSearchResponse } from '../models/rest/rrid-search/rrid-search-response';
import { RridSearchResponseItem } from '../models/rest/rrid-search/rrid-search-response-item';
import { JsonSchema } from '../models/json-schema.model';
import { RridDetailResponse } from '../models/rest/rrid-detail/rrid-detail-response';

@Injectable({
  providedIn: 'root',
})
export class RridFieldDataService {
  private rridSearchUrl;
  private rridDetailsUrl;

  constructor(private http: HttpClient) {}
  setRridSearchUrl(rridSearchUrl: string): void {
    this.rridSearchUrl = rridSearchUrl;
  }

  setRridDetailsUrl(rridDetailsUrl: string): void {
    this.rridDetailsUrl = rridDetailsUrl;
  }

  getData(val: string): Observable<RridSearchResponse> {
    const params = new HttpParams().set('q', val);
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<RridSearchResponse>(this.rridSearchUrl, { params }).pipe(
          map((response) => {
            const results: RridSearchResponseItem[] = Object.keys(response.results).map((key) => ({
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
  getDetails(id: string): Observable<RridDetailResponse> {
    const encodedId = encodeURIComponent(id);
    return this.http.get<RridDetailResponse>(`${this.rridDetailsUrl}/${encodedId}`, {});
  }
}
