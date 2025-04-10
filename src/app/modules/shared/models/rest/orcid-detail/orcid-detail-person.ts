import { Employment } from './orcid-detail-employment';

export class ResearcherDetails {
  id: string;
  found: boolean;
  fullName: string;
  creditName: string;
  otherNames: string[];
  biography: string;
  emails: string[];
  emailDomains: string[];
  employments: Employment[];
  keywords: string[];
  country: string;

  constructor(
    id: string,
    fullName: string,
    creditName: string,
    otherNames: string[],
    biography: string,
    emails: string[],
    employments: Employment[],
    keywords: string[],
    country: string,
  ) {
    this.id = id;
    this.fullName = fullName;
    this.creditName = creditName;
    this.otherNames = otherNames;
    this.biography = biography;
    this.emails = emails;
    // Compute email domains from the email addresses.
    this.emailDomains = emails.map((email) => {
      const parts = email.split('@');
      return parts.length > 1 ? parts[1] : '';
    });
    this.employments = employments;
    this.keywords = keywords;
    this.country = country;
  }

  // Static factory method to create a Researcher from the full JSON response.
  static fromJson(json: any): ResearcherDetails {
    const raw = json.rawResponse;
    const person = raw.person || {};

    const id = json.id;

    const fullName = person.name['given-names'].value + ' ' + person.name['family-name'].value || '';
    const creditName: string = person.name['credit-name']?.value || '';

    const _otherNames = person['other-names'];
    let otherNames: string[] =
      _otherNames && Array.isArray(_otherNames['other-name'])
        ? _otherNames['other-name']
            .sort(function (a, b) {
              return a['display-index'] - b['display-index'];
            })
            .map((otherName) => otherName.content)
        : [];

    if (fullName !== '' && creditName !== '') {
      otherNames = [fullName, ...otherNames];
    }

    const biography: string = person.biography?.content || '';

    const emails: string[] =
      person.emails && Array.isArray(person.emails.email)
        ? person.emails.email.map((e: any) => e.email || e.value).filter((val: string) => !!val)
        : [];

    const keywords: string[] =
      person.keywords && person.keywords.keyword && Array.isArray(person.keywords.keyword)
        ? person.keywords.keyword.map((k: any) => k.content.split(',') || k)
        : [];

    let country: string = '';
    if (person.addresses && Array.isArray(person.addresses.address) && person.addresses.address.length > 0) {
      for (const addr of person.addresses.address) {
        if (addr.country) {
          country = addr.country.value;
          break;
        }
      }
    }

    // 3. Employment info:
    const empGroups = raw['activities-summary']?.employments?.['affiliation-group'] || [];
    const employments: Employment[] = [];
    for (const group of empGroups) {
      if (group.summaries && Array.isArray(group.summaries)) {
        for (const summary of group.summaries) {
          const empSummary = summary['employment-summary'];
          const emp = Employment.fromJson(empSummary);
          if (emp) {
            employments.push(emp);
          }
        }
      }
    }
    // Sort the employment records in descending order (most recent start date first)
    employments.sort((a, b) => (b.startDate > a.startDate ? 1 : -1));

    // Fallback: if country was not found from addresses, use the first employment's organization country.
    if (!country && employments.length > 0 && employments[0].organizationCountry) {
      country = employments[0].organizationCountry;
    }

    return new ResearcherDetails(
      id,
      fullName,
      creditName,
      otherNames,
      biography,
      emails,
      employments,
      keywords,
      country,
    );
  }
}
