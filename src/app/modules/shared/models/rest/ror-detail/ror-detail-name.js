"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RorName = void 0;
var RorName = /** @class */ (function () {
    function RorName(lang, types, value) {
        this.lang = lang;
        this.types = types;
        this.value = value;
    }
    RorName.fromJSON = function (json) {
        return new RorName(json.lang, json.types, json.value);
    };
    return RorName;
}());
exports.RorName = RorName;
