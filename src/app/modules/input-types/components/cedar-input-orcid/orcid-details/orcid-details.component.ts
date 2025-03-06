import { Component, Input, OnInit } from '@angular/core';
import { ResearcherDetails } from '../../../../shared/models/rest/orcid-detail/orcid-detail-person';

@Component({
  selector: 'app-orcid-details',
  templateUrl: './orcid-details.component.html',
  styleUrls: ['./orcid-details.component.scss'],
})
export class OrcidDetailsComponent implements OnInit {
  @Input() researcher: ResearcherDetails;
  @Input() close: (value: boolean) => void;

  constructor() {}

  ngOnInit(): void {
    console.log('Researcher is', JSON.stringify(this.researcher));
  }

  closeClicked() {
    this.close(false);
  }
}
