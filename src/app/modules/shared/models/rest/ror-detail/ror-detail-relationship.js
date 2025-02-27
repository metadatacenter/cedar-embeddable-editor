"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Relationship = void 0;
var Relationship = /** @class */ (function () {
    function Relationship(label, type, id) {
        this.label = label;
        this.type = type;
        this.id = id;
    }
    Relationship.fromJSON = function (json) {
        return new Relationship(json.label, json.type, json.id);
    };
    return Relationship;
}());
exports.Relationship = Relationship;
