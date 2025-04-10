'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.RorFieldDataService = void 0;
var rxjs_1 = require('rxjs');
var ror_search_request_1 = require('../models/rest/ror-search/ror-search-request');
var operators_1 = require('rxjs/operators');
var RorFieldDataService = /** @class */ (function () {
  function RorFieldDataService(http, messageHandlerService) {
    this.http = http;
    this.messageHandlerService = messageHandlerService;
    this.rorSearchUrl = null;
  }
  // setRorSearchUrl(rorSearchUrl: string): void {
  RorFieldDataService.prototype.setRorSearchUrl = function () {
    // this.terminologyIntegratedSearchUrl = terminologyIntegratedSearchUrl;
    this.rorSearchUrl = 'https://bridge.metadatacenter.orgx/ext-auth/ror/';
  };
  RorFieldDataService.prototype.getData = function (val) {
    var _this = this;
    var postData = new ror_search_request_1.RorSearchRequest();
    postData.parameterObject.inputText = val;
    var randomDelay = Math.floor(Math.random() * 2000);
    return (0, rxjs_1.timer)(randomDelay).pipe(
      (0, operators_1.switchMap)(function () {
        return _this.http.post(_this.rorSearchUrl, postData);
      }),
    );
  };
  return RorFieldDataService;
})();
exports.RorFieldDataService = RorFieldDataService;
