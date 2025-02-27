"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandlerService = void 0;
var core_1 = require("@angular/core");
var MessageHandlerService = /** @class */ (function () {
    function MessageHandlerService() {
        this.eventHandler = null;
    }
    MessageHandlerService.prototype.injectEventHandler = function (value) {
        this.eventHandler = value;
    };
    MessageHandlerService.prototype.trace = function (label) {
        console.log('CEE TRACE: ' + label);
    };
    MessageHandlerService.prototype.traceGroup = function (group, label) {
        console.log('CEE TRACE: ' + group + ' : ' + label);
    };
    MessageHandlerService.prototype.traceObject = function (label, value) {
        console.log('CEE TRACE: ' + label);
        console.log(value);
    };
    MessageHandlerService.prototype.error = function (label) {
        console.error('CEE ERROR: ' + label);
    };
    MessageHandlerService.prototype.errorObject = function (label, value) {
        console.error('CEE ERROR: ' + label);
        console.error(value);
    };
    MessageHandlerService = __decorate([
        (0, core_1.Injectable)({
            providedIn: 'root',
        })
    ], MessageHandlerService);
    return MessageHandlerService;
}());
exports.MessageHandlerService = MessageHandlerService;
