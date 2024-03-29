import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { IntegratedSearchResponse } from '../models/rest/integrated-search/integrated-search-response';
import { IntegratedSearchRequest } from '../models/rest/integrated-search/integrated-search-request';
import { FieldComponent } from '../models/component/field-component.model';
import { HttpClient } from '@angular/common/http';
import { MessageHandlerService } from './message-handler.service';
import { switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ControlledFieldDataService {
  private terminologyIntegratedSearchUrl = null;

  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
  ) {}

  setTerminologyIntegratedSearchUrl(terminologyIntegratedSearchUrl: string): void {
    this.terminologyIntegratedSearchUrl = terminologyIntegratedSearchUrl;
  }

  getData(val: string, component: FieldComponent): Observable<IntegratedSearchResponse> {
    const postData = new IntegratedSearchRequest();
    postData.parameterObject.inputText = val;
    postData.parameterObject.valueConstraints.branches = component.controlledInfo.branches;
    postData.parameterObject.valueConstraints.classes = component.controlledInfo.classes;
    postData.parameterObject.valueConstraints.ontologies = component.controlledInfo.ontologies;
    postData.parameterObject.valueConstraints.valueSets = component.controlledInfo.valueSets;
    // Random delay to prevent throttling
    const randomDelay = Math.floor(Math.random() * 2000);
    return timer(randomDelay).pipe(
      switchMap(() => this.http.post<IntegratedSearchResponse>(this.terminologyIntegratedSearchUrl, postData)),
    );
  }
}
