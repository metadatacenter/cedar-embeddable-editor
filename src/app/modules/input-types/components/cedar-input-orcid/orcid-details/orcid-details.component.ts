import { Component, Input } from '@angular/core';
import { ResearcherDetails } from '../../../../shared/models/rest/orcid-detail/orcid-detail-person';

@Component({
  selector: 'app-orcid-details',
  templateUrl: './orcid-details.component.html',
  styleUrls: ['./orcid-details.component.scss'],
})
export class OrcidDetailsComponent {
  @Input() researcher: ResearcherDetails;
  @Input() close: (value: boolean) => void;

  constructor() {}
  closeClicked() {
    this.close(false);
  }
  getFormattedOrganization(emp): string {
    return [emp.organizationCity, emp.organizationRegion, emp.organizationCountry]
      .filter((value) => value && value.trim() !== '')
      .join(', ');
  }
}
