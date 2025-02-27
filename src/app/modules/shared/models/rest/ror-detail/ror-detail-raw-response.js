"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RorDetailRawResponse = void 0;
var ror_detail_external_id_1 = require("./ror-detail-external-id");
var ror_detail_link_1 = require("./ror-detail-link");
var ror_detail_location_1 = require("./ror-detail-location");
var ror_detail_name_1 = require("./ror-detail-name");
var ror_detail_relationship_1 = require("./ror-detail-relationship");
var RorDetailRawResponse = /** @class */ (function () {
    function RorDetailRawResponse(established, external_ids, id, links, locations, names, relationships, status, types) {
        this.established = established;
        this.external_ids = external_ids;
        this.id = id;
        this.links = links;
        this.locations = locations;
        this.names = names;
        this.relationships = relationships;
        this.status = status;
        this.types = types;
    }
    RorDetailRawResponse.fromJSON = function (json) {
        var established = json.established;
        var external_ids = (json.external_ids || []).map(function (item) { return ror_detail_external_id_1.ExternalId.fromJSON(item); });
        var id = json.id;
        var links = (json.links || []).map(function (item) { return ror_detail_link_1.Link.fromJSON(item); });
        var locations = (json.locations || []).map(function (item) { return ror_detail_location_1.Location.fromJSON(item); });
        var names = (json.names || []).map(function (item) { return ror_detail_name_1.RorName.fromJSON(item); });
        var relationships = (json.relationships || []).map(function (item) { return ror_detail_relationship_1.Relationship.fromJSON(item); });
        var status = json.status;
        var types = json.types;
        return new RorDetailRawResponse(established, external_ids, id, links, locations, names, relationships, status, types);
    };
    return RorDetailRawResponse;
}());
exports.RorDetailRawResponse = RorDetailRawResponse;
