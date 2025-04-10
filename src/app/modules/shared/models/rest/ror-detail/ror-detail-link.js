"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Link = void 0;
var Link = /** @class */ (function () {
    function Link(type, value) {
        this.type = type;
        this.value = value;
    }
    Link.fromJSON = function (json) {
        return new Link(json.type, json.value);
    };
    return Link;
}());
exports.Link = Link;
