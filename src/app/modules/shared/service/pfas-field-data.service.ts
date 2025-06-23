import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, switchMap } from 'rxjs/operators';
import { PfasSearchResponse } from '../models/rest/pfas-search/pfas-search-response';
import { PfasSearchResponseItem } from '../models/rest/pfas-search/pfas-search-response-item';
import { JsonSchema } from '../models/json-schema.model';
import { PfasDetailResponse } from '../models/rest/pfas-detail/pfas-detail-response';

@Injectable({
  providedIn: 'root',
})
export class PfasFieldDataService {
  private pfasSearchUrl;
  private pfasDetailsUrl;

  constructor(private http: HttpClient) {}
  setPfasSearchUrl(pfasSearchUrl: string): void {
    this.pfasSearchUrl = pfasSearchUrl;
  }

  setPfasDetailsUrl(pfasDetailsUrl: string): void {
    this.pfasDetailsUrl = pfasDetailsUrl;
  }

  getData(val: string): Observable<PfasSearchResponse> {
    const params = new HttpParams().set('q', val);
    const randomDelay = Math.floor(Math.random() * 500);
    return timer(randomDelay).pipe(
      switchMap(() =>
        this.http.get<PfasSearchResponse>(this.pfasSearchUrl, { params }).pipe(
          map((response) => {
            const results: PfasSearchResponseItem[] = Object.keys(response.results).map((key) => ({
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
  getDetails(id: string): Observable<PfasDetailResponse> {
    const encodedId = encodeURIComponent(id);
    return this.http.get<PfasDetailResponse>(`${this.pfasDetailsUrl}/${encodedId}`, {});
  }
}
