"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegratedSearchRequest = void 0;
var integrated_search_request_parameter_object_1 = require("./integrated-search-request-parameter-object");
var IntegratedSearchRequest = /** @class */ (function () {
    function IntegratedSearchRequest() {
        this.parameterObject = new integrated_search_request_parameter_object_1.IntegratedSearchRequestParameterObject();
        this.page = 1;
        this.pageSize = 50;
    }
    return IntegratedSearchRequest;
}());
exports.IntegratedSearchRequest = IntegratedSearchRequest;
