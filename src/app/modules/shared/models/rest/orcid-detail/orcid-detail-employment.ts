export class Employment {
  roleTitle: string;
  startDate: string; // formatted as "YYYY-MM-DD"
  endDate?: string; // formatted as "YYYY-MM-DD", if available
  organizationName: string;
  organizationCountry?: string;
  organizationCity?: string;
  organizationRegion?: string;

  constructor(
    roleTitle: string,
    startDate: string,
    endDate: string | undefined,
    organizationName: string,
    organizationCountry?: string,
    organizationCity?: string,
    organizationRegion?: string,
  ) {
    this.roleTitle = roleTitle;
    this.startDate = startDate;
    this.endDate = endDate;
    this.organizationName = organizationName;
    this.organizationCountry = organizationCountry;
    this.organizationCity = organizationCity;
    this.organizationRegion = organizationRegion;
  }
  private static parseAndFormatDate(dateObj: any): string | null {
    if (!dateObj || !dateObj.year || !dateObj.year.value) {
      return null;
    }
    const year = parseInt(dateObj.year.value, 10);
    const month = dateObj.month && dateObj.month.value ? parseInt(dateObj.month.value, 10) : 1;
    const day = dateObj.day && dateObj.day.value ? parseInt(dateObj.day.value, 10) : 1;
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  }

  static fromJson(json: any): Employment | null {
    if (!json) return null;

    const roleTitle: string = json['role-title'] || 'Unknown';

    const startDate: string | null = Employment.parseAndFormatDate(json['start-date']);
    const endDate: string | null = Employment.parseAndFormatDate(json['end-date']);

    const organization = json.organization || {};
    const organizationName: string = organization.name || 'Unknown Organization';
    const organizationCountry: string | undefined =
      organization.address && organization.address.country ? organization.address.country : undefined;
    const organizationCity: string | undefined =
      organization.address && organization.address.city ? organization.address.city : undefined;
    const organizationRegion: string | undefined =
      organization.address && organization.address.region ? organization.address.region : undefined;

    return new Employment(
      roleTitle,
      startDate,
      endDate || undefined,
      organizationName,
      organizationCountry,
      organizationCity,
      organizationRegion,
    );
  }
}
