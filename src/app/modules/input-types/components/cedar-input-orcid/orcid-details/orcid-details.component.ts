import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { ResearcherDetails } from '../../../../shared/models/rest/orcid-detail/orcid-detail-person';
import { Employment } from '../../../../shared/models/rest/orcid-detail/orcid-detail-employment';

@Component({
  selector: 'app-orcid-details',
  templateUrl: './orcid-details.component.html',
  styleUrls: ['./orcid-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class OrcidDetailsComponent {
  @Input({ required: true }) researcher!: ResearcherDetails;
  /** What the panel's close button does. A no-op until the host says otherwise. */
  @Input() close: (value: boolean) => void = () => {};

  constructor() {}
  closeClicked() {
    this.close(false);
  }
  getFormattedOrganization(emp: Employment): string {
    return [emp.organizationCity, emp.organizationRegion, emp.organizationCountry]
      .filter((value) => value && value.trim() !== '')
      .join(', ');
  }
}
