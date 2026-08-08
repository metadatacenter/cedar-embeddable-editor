import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RorDetailResponse } from '../../../../shared/models/rest/ror-detail/ror-detail-response';
import { Relationship } from '../../../../shared/models/rest/ror-detail/ror-detail-relationship';

@Component({
  selector: 'app-ror-details',
  templateUrl: './ror-details.component.html',
  styleUrls: ['./ror-details.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class RorDetailsComponent implements OnInit {
  groupedRelationships: Record<string, Relationship[]> = {};

  @Input({ required: true }) rorDetail!: RorDetailResponse;
  /** What the panel's close button does. A no-op until the host says otherwise. */
  @Input() close: (value: boolean) => void = () => {};
  constructor() {}
  ngOnInit(): void {
    if (this.rorDetail?.rawResponse?.relationships) {
      this.groupedRelationships = this.groupBy(this.rorDetail.rawResponse.relationships, 'type');
    }
  }

  /*
   * Generic rather than `any[]`, so the grouped output keeps the element type the
   * caller passed in. `keyof T & string` because the key both indexes the item and
   * becomes a property name on the result.
   */
  groupBy<T>(array: T[], key: keyof T & string): Record<string, T[]> {
    return array.reduce<Record<string, T[]>>((result, item) => {
      const groupKey = String(item[key]);
      (result[groupKey] = result[groupKey] || []).push(item);
      return result;
    }, {});
  }

  closeClicked() {
    this.close(false);
  }
}
