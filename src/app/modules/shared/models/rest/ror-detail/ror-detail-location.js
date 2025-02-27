"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Location = void 0;
var ror_detail_geoname_details_1 = require("./ror-detail-geoname-details");
var Location = /** @class */ (function () {
    function Location(geonames_details, geonames_id) {
        this.geonames_details = geonames_details;
        this.geonames_id = geonames_id;
    }
    Location.fromJSON = function (json) {
        return new Location(ror_detail_geoname_details_1.GeonamesDetails.fromJSON(json.geonames_details), json.geonames_id);
    };
    return Location;
}());
exports.Location = Location;
