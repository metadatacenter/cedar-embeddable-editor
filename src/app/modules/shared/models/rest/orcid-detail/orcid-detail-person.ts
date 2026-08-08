import { Employment } from './orcid-detail-employment';
import { OrcidEmploymentJson } from './orcid-detail-employment';

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
    /**
     * The employment history, declared because `fromJson` walks it. Only the two
     * levels this reader steps through are named; `employment-summary` is handed
     * straight to `Employment.fromJson`, which is where its shape belongs.
     */
    'activities-summary'?: {
      employments?: {
        'affiliation-group'?: { summaries?: { 'employment-summary'?: unknown }[] }[];
      };
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
    const raw = json.rawResponse ?? {};
    const person = raw.person ?? {};

    const id = json.id;

    // Optional all the way down, because the record is ORCID's and every one of
    // these is genuinely absent for some researchers. `person.name['given-names']
    // .value` read three levels unguarded, so a record with no given name — a
    // mononymous researcher, or a name withheld by privacy settings — threw here
    // rather than rendering the credit name it falls back to.
    const given = person.name?.['given-names']?.value ?? '';
    const family = person.name?.['family-name']?.value ?? '';
    const fullName = [given, family].filter((part) => part !== '').join(' ');
    const creditName: string = person.name?.['credit-name']?.value ?? '';

    const _otherNames = person['other-names'];
    // `?? 0` on the sort key and an empty-string drop on the content: both are
    // optional in the record, and an entry without a display index used to make
    // the comparator return NaN, which leaves the order undefined rather than
    // sorting that entry last.
    let otherNames: string[] =
      _otherNames && Array.isArray(_otherNames['other-name'])
        ? _otherNames['other-name']
            .sort((a, b) => (a['display-index'] ?? 0) - (b['display-index'] ?? 0))
            .map((otherName) => otherName.content ?? '')
            .filter((name) => name !== '')
        : [];

    if (fullName !== '' && creditName !== '') {
      otherNames = [fullName, ...otherNames];
    }

    const biography: string = person.biography?.content || '';

    const emails: string[] =
      person.emails && Array.isArray(person.emails.email)
        ? person.emails.email.map((e: OrcidEmailJson) => e.email ?? e.value ?? '').filter((val) => val !== '')
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
          country = addr.country.value ?? '';
          break;
        }
      }
    }

    const empGroups = raw['activities-summary']?.employments?.['affiliation-group'] || [];
    const employments: Employment[] = [];
    for (const group of empGroups) {
      if (group.summaries && Array.isArray(group.summaries)) {
        for (const summary of group.summaries) {
          // Declared `unknown` on the record because its shape belongs to
          // `Employment.fromJson`, which is where it is read; the cast names the
          // handoff rather than widening the declaration to match one consumer.
          const empSummary = summary['employment-summary'] as OrcidEmploymentJson | null | undefined;
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
