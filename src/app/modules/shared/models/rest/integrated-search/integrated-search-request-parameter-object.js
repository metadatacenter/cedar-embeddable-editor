"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegratedSearchRequestParameterObject = void 0;
var integrated_search_request_value_constraints_1 = require("./integrated-search-request-value-constraints");
var IntegratedSearchRequestParameterObject = /** @class */ (function () {
    function IntegratedSearchRequestParameterObject() {
        this.valueConstraints = new integrated_search_request_value_constraints_1.IntegratedSearchRequestValueConstraints();
        this.inputText = '';
    }
    return IntegratedSearchRequestParameterObject;
}());
exports.IntegratedSearchRequestParameterObject = IntegratedSearchRequestParameterObject;
