"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticFieldComponent = void 0;
var label_info_model_1 = require("../info/label-info.model");
var basic_info_model_1 = require("../info/basic-info.model");
var content_info_model_1 = require("../info/content-info.model");
var StaticFieldComponent = /** @class */ (function () {
    function StaticFieldComponent() {
        this.className = 'StaticFieldComponent';
        this.labelInfo = new label_info_model_1.LabelInfo();
        this.basicInfo = new basic_info_model_1.BasicInfo();
        this.contentInfo = new content_info_model_1.ContentInfo();
        this.linkedStaticFieldComponent = null;
    }
    StaticFieldComponent.prototype.isMulti = function () {
        return false;
    };
    StaticFieldComponent.prototype.isMultiPage = function () {
        return false;
    };
    return StaticFieldComponent;
}());
exports.StaticFieldComponent = StaticFieldComponent;
