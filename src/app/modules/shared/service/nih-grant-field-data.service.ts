import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { JsonSchema } from '../models/json-schema.model';
import { NihGrantSearchResponse } from '../models/rest/nih-grant-search/nih-grant-search-response';
import { NihGrantDetailResponse } from '../models/rest/nih-grant-detail/nih-grant-detail-response';
import { NihGrantSearchResponseItem } from '../models/rest/nih-grant-search/nih-grant-search-response-item';

@Injectable({
  providedIn: 'root',
})
export class NihGrantFieldDataService {
  private nihGrantSearchUrl;
  private nihGrantDetailsUrl;

  constructor(private http: HttpClient) {}

  setNihGrantSearchUrl(nihGrantSearchUrl: string) {
    this.nihGrantSearchUrl = nihGrantSearchUrl;
  }
  setNihGrantDetailsUrl(nihGrantDetailsUrl: string) {
    this.nihGrantDetailsUrl = nihGrantDetailsUrl;
  }
  getData(val: string): Observable<NihGrantSearchResponse> {
    const params = new HttpParams().set('q', val);
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<NihGrantSearchResponse>(this.nihGrantSearchUrl, { params }).pipe(
          map((response) => {
            const results: NihGrantSearchResponseItem[] = Object.keys(response.results).map((key) => ({
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
  getDetails(id: string): Observable<NihGrantDetailResponse> {
    const encodedId = encodeURIComponent(id);
    return this.http.get<NihGrantDetailResponse>(`${this.nihGrantDetailsUrl}/${encodedId}`, {});
  }
}
