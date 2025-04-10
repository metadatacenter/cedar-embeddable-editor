"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeonamesDetails = void 0;
var GeonamesDetails = /** @class */ (function () {
    function GeonamesDetails(continent_code, continent_name, country_code, country_name, country_subdivision_code, country_subdivision_name, lat, lng, name) {
        this.continent_code = continent_code;
        this.continent_name = continent_name;
        this.country_code = country_code;
        this.country_name = country_name;
        this.country_subdivision_code = country_subdivision_code;
        this.country_subdivision_name = country_subdivision_name;
        this.lat = lat;
        this.lng = lng;
        this.name = name;
    }
    GeonamesDetails.fromJSON = function (json) {
        return new GeonamesDetails(json.continent_code, json.continent_name, json.country_code, json.country_name, json.country_subdivision_code, json.country_subdivision_name, json.lat, json.lng, json.name);
    };
    return GeonamesDetails;
}());
exports.GeonamesDetails = GeonamesDetails;
