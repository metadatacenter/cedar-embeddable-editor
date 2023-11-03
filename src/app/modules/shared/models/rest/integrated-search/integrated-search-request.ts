import { IntegratedSearchRequestParameterObject } from './integrated-search-request-parameter-object';

export class IntegratedSearchRequest {
  parameterObject: IntegratedSearchRequestParameterObject = new IntegratedSearchRequestParameterObject();
  page = 1;
  pageSize = 50;
}
