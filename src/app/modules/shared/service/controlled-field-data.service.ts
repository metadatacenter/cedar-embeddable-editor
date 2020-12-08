import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {IntegratedSearchResponse} from '../models/rest/integrated-search/integrated-search-response';
import {IntegratedSearchRequest} from '../models/rest/integrated-search/integrated-search-request';
import {FieldComponent} from '../models/component/field-component.model';
import {HttpClient} from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ControlledFieldDataService {

  private terminologyProxyUrl = null;


  constructor(
    private http: HttpClient
  ) {
  }

  setTerminologyProxyUrl(terminologyProxyUrl: string): void {
    this.terminologyProxyUrl = terminologyProxyUrl;
  }

  getData(val: string, component: FieldComponent): Observable<IntegratedSearchResponse> {
    const url = 'https://api-php.cee.metadatacenter.orgx/index.php';
    const postData = new IntegratedSearchRequest();
    postData.parameterObject.inputText = val;
    postData.parameterObject.valueConstraints.branches = component.controlledInfo.branches;
    postData.parameterObject.valueConstraints.classes = component.controlledInfo.classes;
    postData.parameterObject.valueConstraints.ontologies = component.controlledInfo.ontologies;
    postData.parameterObject.valueConstraints.valueSets = component.controlledInfo.valueSets;
    console.log('READ SEARCH');
    console.log(postData);
    return this.http.post<IntegratedSearchResponse>(url, postData);
  }

}
