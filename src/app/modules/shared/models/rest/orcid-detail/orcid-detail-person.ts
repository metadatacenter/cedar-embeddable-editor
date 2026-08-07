import { Employment } from './orcid-detail-employment';

/**
 * The parts of an ORCID record this reads.
 *
 * Only what the parser touches, and every field optional, because ORCID guarantees
 * none of them and the code below already tests for each. The point of writing it
 * down is that a key ORCID renames — and they are hyphenated strings, easy to get
 * subtly wrong — fails the build rather than silently producing an empty profile.
 */
interface OrcidEmailJson {
  email?: string;
  value?: string;
}

interface OrcidKeywordJson {
  content: string;
}

interface OrcidRecordJson {
  id?: string;
  rawResponse?: {
    person?: {
      name?: {
        'given-names'?: { value?: string };
        'family-name'?: { value?: string };
        'credit-name'?: { value?: string };
      };
      'other-names'?: { 'other-name'?: { content?: string; 'display-index'?: number }[] };
      biography?: { content?: string };
      emails?: { email?: OrcidEmailJson[] };
      keywords?: { keyword?: OrcidKeywordJson[] };
      addresses?: { address?: { country?: { value?: string } }[] };
    };
  };
}

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
    this.emailDomains = emails.map((email) => {
      const parts = email.split('@');
      return parts.length > 1 ? parts[1] : '';
    });
    this.employments = employments;
    this.keywords = keywords;
    this.country = country;
  }
  static fromJson(json: OrcidRecordJson): ResearcherDetails {
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
        ? person.emails.email.map((e: OrcidEmailJson) => e.email || e.value).filter((val: string) => !!val)
        : [];

    const keywords: string[] =
      person.keywords && person.keywords.keyword && Array.isArray(person.keywords.keyword)
        ? // flatMap, not map: ORCID puts several comma-separated keywords in one
          // `content`, so mapping produced an array per entry and `keywords` was
          // string[][] wearing a string[] annotation — which `any` on this parser
          // hid. The template renders each entry with `{{ keyword }}`, so a nested
          // array arrived via Array.toString and joined without the spacing the
          // surrounding list uses. Trimmed and emptied-out here instead.
          //
          // The `|| k` this replaces was unreachable: split() never returns falsy.
          person.keywords.keyword
            .flatMap((k: OrcidKeywordJson) => (k.content ?? '').split(','))
            .map((keyword: string) => keyword.trim())
            .filter((keyword: string) => keyword !== '')
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
    employments.sort((a, b) => (b.startDate > a.startDate ? 1 : -1));

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
