import { IntegratedSearchRequestParameterObject } from './integrated-search-request-parameter-object';

export class IntegratedSearchRequest {
  parameterObject: IntegratedSearchRequestParameterObject = new IntegratedSearchRequestParameterObject();
  offset = 0;
  limit = 50;
}
