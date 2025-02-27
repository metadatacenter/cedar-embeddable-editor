"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrcidFieldDataService = void 0;
var core_1 = require("@angular/core");
var rxjs_1 = require("rxjs");
var http_1 = require("@angular/common/http");
var operators_1 = require("rxjs/operators");
var OrcidFieldDataService = /** @class */ (function () {
    function OrcidFieldDataService(http, messageHandlerService) {
        this.http = http;
        this.messageHandlerService = messageHandlerService;
        this.orcidSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/orcid/search-by-name';
        this.orcidDetailsUrl = 'https://bridge.metadatacenter.orgx/ext-auth/orcid';
    }
    // setRorSearchUrl(rorSearchUrl: string): void {
    OrcidFieldDataService.prototype.setRorSearchUrl = function () {
        // this.terminologyIntegratedSearchUrl = terminologyIntegratedSearchUrl;
        this.orcidSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/orcid/search-by-name';
    };
    OrcidFieldDataService.prototype.getData = function (val) {
        var _this = this;
        var params = new http_1.HttpParams().set('q', val);
        // Random delay to prevent throttling
        var randomDelay = Math.floor(Math.random() * 500);
        return (0, rxjs_1.timer)(randomDelay).pipe((0, operators_1.switchMap)(function () {
            return _this.http.get(_this.orcidSearchUrl, { params: params }).pipe((0, operators_1.map)(function (response) {
                var results = Object.keys(response.results).map(function (key) { return ({
                    id: key,
                    rdfsLabel: response.results[key],
                }); });
                // Return the response matching the RorSearchResponse interface
                return {
                    found: response.found,
                    results: results,
                };
            }));
        }));
    };
    OrcidFieldDataService.prototype.getDetails = function (id) {
        var encodedId = encodeURIComponent(id);
        return this.http.get("".concat(this.orcidDetailsUrl, "/").concat(encodedId), {});
    };
    OrcidFieldDataService = __decorate([
        (0, core_1.Injectable)({
            providedIn: 'root',
        })
    ], OrcidFieldDataService);
    return OrcidFieldDataService;
}());
exports.OrcidFieldDataService = OrcidFieldDataService;
