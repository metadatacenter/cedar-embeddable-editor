import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { RorSearchResponse } from '../models/rest/ror-search/ror-search-response';
import { RorSearchResponseItem } from '../models/rest/ror-search/ror-search-response-item';
import { RorDetailResponse } from '../models/rest/ror-detail/ror-detail-response';

@Injectable({
  providedIn: 'root',
})
export class RorFieldDataService {
  private rorSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/ror/search-by-name';
  private rorDetailsUrl = 'https://bridge.metadatacenter.orgx/ext-auth/ror';

  constructor(private http: HttpClient) {}

  // setRorSearchUrl(rorSearchUrl: string): void {
  setRorSearchUrl(): void {
    // this.terminologyIntegratedSearchUrl = terminologyIntegratedSearchUrl;
    this.rorSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/ror/search-by-name';
  }

  getData(val: string): Observable<RorSearchResponse> {
    const params = new HttpParams().set('q', val);
    // Random delay to prevent throttling
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<RorSearchResponse>(this.rorSearchUrl, { params }).pipe(
          map((response) => {
            const results: RorSearchResponseItem[] = Object.keys(response.results).map((key) => ({
              id: key,
              rdfsLabel: response.results[key].name,
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
