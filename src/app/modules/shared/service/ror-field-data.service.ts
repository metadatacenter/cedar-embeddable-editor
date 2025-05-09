import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { RorSearchResponse } from '../models/rest/ror-search/ror-search-response';
import { RorSearchResponseItem } from '../models/rest/ror-search/ror-search-response-item';
import { RorDetailResponse } from '../models/rest/ror-detail/ror-detail-response';
import { JsonSchema } from '../models/json-schema.model';

@Injectable({
  providedIn: 'root',
})
export class RorFieldDataService {
  private rorSearchUrl;
  private rorDetailsUrl;

  constructor(private http: HttpClient) {}
  setRorSearchUrl(rorSearchUrl: string): void {
    this.rorSearchUrl = rorSearchUrl;
  }
  setRorDetailsUrl(rorDetailsUrl: string): void {
    this.rorDetailsUrl = rorDetailsUrl;
  }

  getData(val: string): Observable<RorSearchResponse> {
    const params = new HttpParams().set('q', val);
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<RorSearchResponse>(this.rorSearchUrl, { params }).pipe(
          map((response) => {
            const results: RorSearchResponseItem[] = Object.keys(response.results).map((key) => ({
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

  getDetails(id: string): Observable<RorDetailResponse> {
    const encodedId = encodeURIComponent(id);
    return this.http.get<RorDetailResponse>(`${this.rorDetailsUrl}/${encodedId}`, {});
  }
}
