"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Researcher = void 0;
var orcid_detail_employment_1 = require("./orcid-detail-employment");
var Researcher = /** @class */ (function () {
    function Researcher(biography, emails, employments, keywords, country) {
        this.biography = biography;
        this.emails = emails;
        // Compute email domains from the email addresses.
        this.emailDomains = emails.map(function (email) {
            var parts = email.split('@');
            return parts.length > 1 ? parts[1] : '';
        });
        this.employments = employments;
        this.keywords = keywords;
        this.country = country;
    }
    // Static factory method to create a Researcher from the full JSON response.
    Researcher.fromJson = function (json) {
        var _a, _b;
        var raw = json.rawResponse;
        var person = raw.person || {};
        // 1. Biography (may be null)
        var biography = person.biography || '';
        // 2. Emails: assuming person.emails.email is an array.
        var emails = person.emails && Array.isArray(person.emails.email)
            ? person.emails.email
                .map(function (e) { return e.email || e.value; }) // sometimes the email value might be stored under a different key
                .filter(function (val) { return !!val; })
            : [];
        // 4. Keywords: assuming person.keywords.keyword is an array of objects with a "value" property.
        var keywords = person.keywords && Array.isArray(person.keywords.keyword)
            ? person.keywords.keyword.map(function (k) { return k.value || k; }).filter(function (val) { return !!val; })
            : [];
        // 5. Country: try to get it from the person addresses if available.
        var country = '';
        if (person.addresses && Array.isArray(person.addresses.address) && person.addresses.address.length > 0) {
            // If multiple addresses exist, pick the first one with a country defined.
            for (var _i = 0, _c = person.addresses.address; _i < _c.length; _i++) {
                var addr = _c[_i];
                if (addr.country) {
                    country = addr.country;
                    break;
                }
            }
        }
        // 3. Employment info:
        var empGroups = ((_b = (_a = raw['activities-summary']) === null || _a === void 0 ? void 0 : _a.employments) === null || _b === void 0 ? void 0 : _b['affiliation-group']) || [];
        var employments = [];
        for (var _d = 0, empGroups_1 = empGroups; _d < empGroups_1.length; _d++) {
            var group = empGroups_1[_d];
            if (group.summaries && Array.isArray(group.summaries)) {
                for (var _e = 0, _f = group.summaries; _e < _f.length; _e++) {
                    var summary = _f[_e];
                    var empSummary = summary['employment-summary'];
                    var emp = orcid_detail_employment_1.Employment.fromJson(empSummary);
                    if (emp) {
                        employments.push(emp);
                    }
                }
            }
        }
        // Sort the employment records in descending order (most recent start date first)
        employments.sort(function (a, b) { return b.startDate.getTime() - a.startDate.getTime(); });
        // Fallback: if country was not found from addresses, try to use the first employment's organization country.
        if (!country && employments.length > 0 && employments[0].organizationCountry) {
            country = employments[0].organizationCountry;
        }
        return new Researcher(biography, emails, employments, keywords, country);
    };
    return Researcher;
}());
exports.Researcher = Researcher;
