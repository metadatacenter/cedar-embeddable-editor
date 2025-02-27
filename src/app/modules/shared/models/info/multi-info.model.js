"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiInfo = void 0;
var MultiInfo = /** @class */ (function () {
    function MultiInfo() {
    }
    MultiInfo.prototype.getSafeMinItems = function () {
        return this.minItems === null ? 0 : this.minItems;
    };
    return MultiInfo;
}());
exports.MultiInfo = MultiInfo;
