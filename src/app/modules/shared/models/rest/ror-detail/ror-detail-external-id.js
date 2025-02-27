"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalId = void 0;
var ExternalId = /** @class */ (function () {
    function ExternalId(all, preferred, type) {
        this.all = all;
        this.preferred = preferred;
        this.type = type;
    }
    ExternalId.fromJSON = function (json) {
        return new ExternalId(json.all, json.preferred, json.type);
    };
    return ExternalId;
}());
exports.ExternalId = ExternalId;
