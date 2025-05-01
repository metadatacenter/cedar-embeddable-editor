import { Component, Input, OnInit } from '@angular/core';
import { RorDetailResponse } from '../../../../shared/models/rest/ror-detail/ror-detail-response';

@Component({
  selector: 'app-ror-details',
  templateUrl: './ror-details.component.html',
  styleUrls: ['./ror-details.component.scss'],
})
export class RorDetailsComponent implements OnInit {
  groupedRelationships: { [key: string]: any[] } = {};

  @Input() rorDetail: RorDetailResponse;
  @Input() close: (value: boolean) => void;
  constructor() {}
  ngOnInit(): void {
    if (this.rorDetail?.rawResponse?.relationships) {
      this.groupedRelationships = this.groupBy(this.rorDetail.rawResponse.relationships, 'type');
    }
  }

  groupBy(array: any[], key: string): { [key: string]: any[] } {
    return array.reduce((result, item) => {
      const groupKey = item[key];
      (result[groupKey] = result[groupKey] || []).push(item);
      return result;
    }, {});
  }

  closeClicked() {
    this.close(false);
  }
}
