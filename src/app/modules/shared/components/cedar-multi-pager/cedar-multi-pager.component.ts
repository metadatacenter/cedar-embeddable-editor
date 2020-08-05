import {Component, Input, OnInit} from '@angular/core';
import {MultiComponent} from '../../models/component/multi-component.model';
import {PageEvent} from '@angular/material/paginator';

@Component({
  selector: 'app-cedar-multi-pager',
  templateUrl: './cedar-multi-pager.component.html',
  styleUrls: ['./cedar-multi-pager.component.scss']
})
export class CedarMultiPagerComponent implements OnInit {

  component: MultiComponent;

  length = 0;
  pageSize = 1;
  pageSizeOptions: number[] = [1, 2, 5, 10, 25];

  firstIndex = 0;
  lastIndex = -1;
  pageNumbers: number[] = [];

  pageEvent: PageEvent;

  constructor() {
  }

  ngOnInit(): void {
  }

  @Input() set componentToRender(componentToRender: MultiComponent) {
    this.component = componentToRender;
    if (this.component != null && this.component.currentMultiInfo != null) {
      this.length = this.component.currentMultiInfo.count;
      this.firstIndex = 0;
      this.computeLastIndex();
      this.updatePageNumber(this.firstIndex, this.lastIndex);
    }
  }

  pageChanged($event: PageEvent): void {
    this.pageSize = $event.pageSize;
    this.firstIndex = $event.pageIndex * $event.pageSize;
    this.computeLastIndex();
    this.updatePageNumber(this.firstIndex, this.lastIndex);
  }

  private updatePageNumber(firstIndex: number, lastIndex: number): void {
    this.pageNumbers = [];
    for (let idx = this.firstIndex; idx <= this.lastIndex; idx++) {
      this.pageNumbers.push(idx);
    }
  }

  private computeLastIndex(): void {
    if (this.length > 0) {
      this.lastIndex = this.firstIndex + this.pageSize - 1;
      if (this.lastIndex > this.length - 1) {
        this.lastIndex = this.length - 1;
      }
    }
  }

  chipClicked(chipIdx: number): void {
    this.component.currentMultiInfo.currentIndex = chipIdx;
  }

}
