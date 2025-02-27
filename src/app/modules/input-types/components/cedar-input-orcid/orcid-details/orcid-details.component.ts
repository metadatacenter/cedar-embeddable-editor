import { Component, Input, OnInit } from '@angular/core';
import { Researcher } from '../../../../shared/models/rest/orcid-detail/orcid-detail-person';

@Component({
  selector: 'app-orcid-details',
  templateUrl: './orcid-details.component.html',
  styleUrls: ['./orcid-details.component.scss'],
})
export class OrcidDetailsComponent implements OnInit {
  @Input() researcher: Researcher;
  @Input() close: (value: boolean) => void;

  constructor() {}

  ngOnInit(): void {}

  closeClicked() {
    this.close(false);
  }
}
