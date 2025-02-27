"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RorDetailResponse = void 0;
var ror_detail_raw_response_1 = require("./ror-detail-raw-response");
var RorDetailResponse = /** @class */ (function () {
    function RorDetailResponse(found, rawResponse, name, id, requestedId) {
        this.found = found;
        this.rawResponse = rawResponse;
        this.name = name;
        this.id = id;
        this.requestedId = requestedId;
    }
    RorDetailResponse.fromJSON = function (json) {
        var rawResponse = ror_detail_raw_response_1.RorDetailRawResponse.fromJSON(json.rawResponse);
        return new RorDetailResponse(json.found, rawResponse, json.name, json.id, json.requestedId);
    };
    return RorDetailResponse;
}());
exports.RorDetailResponse = RorDetailResponse;
