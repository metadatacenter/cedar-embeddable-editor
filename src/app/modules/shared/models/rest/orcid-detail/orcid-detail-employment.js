"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Employment = void 0;
var Employment = /** @class */ (function () {
    function Employment(roleTitle, startDate, endDate, organizationName, organizationCountry) {
        this.roleTitle = roleTitle;
        this.startDate = startDate;
        this.endDate = endDate;
        this.organizationName = organizationName;
        this.organizationCountry = organizationCountry;
    }
    // Helper method to parse date objects from JSON.
    Employment.parseDate = function (dateObj) {
        if (!dateObj || !dateObj.year || !dateObj.year.value) {
            return null;
        }
        var year = parseInt(dateObj.year.value, 10);
        // Month is optional; if missing we assume January.
        var month = dateObj.month && dateObj.month.value ? parseInt(dateObj.month.value, 10) - 1 : 0;
        // Day is optional; default to the first day.
        var day = dateObj.day && dateObj.day.value ? parseInt(dateObj.day.value, 10) : 1;
        return new Date(year, month, day);
    };
    // Create an Employment instance from the employment-summary JSON.
    Employment.fromJson = function (json) {
        if (!json)
            return null;
        // Extract role title
        var roleTitle = json['role-title'] || 'Unknown';
        // Parse the start and end dates
        var startDate = Employment.parseDate(json['start-date']);
        if (!startDate)
            return null; // require a valid start date
        var endDate = Employment.parseDate(json['end-date']);
        // Extract organization information
        var organization = json.organization || {};
        var organizationName = organization.name || 'Unknown Organization';
        var organizationCountry = organization.address && organization.address.country ? organization.address.country : undefined;
        return new Employment(roleTitle, startDate, endDate || undefined, organizationName, organizationCountry);
    };
    return Employment;
}());
exports.Employment = Employment;
