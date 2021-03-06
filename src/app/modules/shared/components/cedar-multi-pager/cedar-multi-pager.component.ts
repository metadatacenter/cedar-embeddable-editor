import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {MultiComponent} from '../../models/component/multi-component.model';
import {PageEvent} from '@angular/material/paginator';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';
import {MultiInstanceObjectInfo} from '../../models/info/multi-instance-object-info.model';
import {HandlerContext} from '../../util/handler-context';

@Component({
  selector: 'app-cedar-multi-pager',
  templateUrl: './cedar-multi-pager.component.html',
  styleUrls: ['./cedar-multi-pager.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarMultiPagerComponent implements OnInit {

  component: MultiComponent;
  currentMultiInfo: MultiInstanceObjectInfo;
  activeComponentRegistry: ActiveComponentRegistryService;
  @Input() handlerContext: HandlerContext;

  length = 0;
  pageSize = 5;
  pageIndex = 0;
  pageSizeOptions: number[] = [1, 2, 5, 10, 25];

  firstIndex = 0;
  lastIndex = -1;
  pageNumbers: number[] = [];

  constructor(activeComponentRegistry: ActiveComponentRegistryService) {
    this.activeComponentRegistry = activeComponentRegistry;
  }

  ngOnInit(): void {
    this.recomputeNumbers();
  }

  @Input() set componentToRender(componentToRender: MultiComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerMultiPagerComponent(this.component, this);

  }

  private recomputeNumbers(): void {
    this.setCurrentMultiInfo();
    this.computeFirstIndex();
    this.computeLastIndex();
    this.updatePageNumbers();
  }

  private setCurrentMultiInfo(): void {
    if (this.component != null && this.handlerContext.multiInstanceObjectService != null) {
      this.currentMultiInfo = this.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(this.component);
    }
  }

  paginatorChanged($event: PageEvent): void {
    if ($event.pageSize !== this.pageSize) {
      this.pageSizeChanged($event);
    } else {
      this.pageChanged($event);
    }
  }

  private pageSizeChanged($event: PageEvent): void {
    this.pageSize = $event.pageSize;
    this.computeFirstIndex();
    this.computeLastIndex();
    this.updatePageNumbers();
  }

  private pageChanged($event: PageEvent): void {
    this.pageSize = $event.pageSize;
    this.firstIndex = $event.pageIndex * $event.pageSize;
    this.handlerContext.multiInstanceObjectService.setCurrentIndex(this.component, this.firstIndex);
    this.computeLastIndex();
    this.updatePageNumbers();
    this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
  }

  private updatePageNumbers(): void {
    this.pageNumbers = [];
    if (this.length > 0) {
      for (let idx = this.firstIndex; idx <= this.lastIndex; idx++) {
        this.pageNumbers.push(idx);
      }
    }
  }

  private computeFirstIndex(): void {
    this.pageIndex = Math.floor(this.currentMultiInfo.currentIndex / this.pageSize);
    this.firstIndex = this.pageIndex * this.pageSize;
  }

  private computeLastIndex(): void {
    this.length = this.currentMultiInfo.currentCount;
    if (this.length > 0) {
      this.lastIndex = this.firstIndex + this.pageSize - 1;
      if (this.lastIndex > this.length - 1) {
        this.lastIndex = this.length - 1;
      }
    } else {
      this.lastIndex = -1;
    }
  }

  chipClicked(chipIdx: number): void {
    this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
    this.handlerContext.setCurrentIndex(this.component, chipIdx);
    this.recomputeNumbers();
    const that = this;
    setTimeout(() => {
      that.activeComponentRegistry.updateViewToModel(that.component, that.handlerContext);
    }, 0);
  }

  clickedAdd(): void {
    this.handlerContext.addMultiInstance(this.component);
    this.recomputeNumbers();
    const that = this;
    // The component will be null if the count was 0 before
    // We need to wait for it to be available
    setTimeout(() => {
      that.activeComponentRegistry.updateViewToModel(that.component, that.handlerContext);
    }, 0);
  }

  clickedCopy(): void {
    this.handlerContext.copyMultiInstance(this.component);
    this.recomputeNumbers();
    const that = this;
    setTimeout(() => {
      that.activeComponentRegistry.updateViewToModel(that.component, that.handlerContext);
    }, 0);
  }

  clickedDelete(): void {
    this.handlerContext.deleteMultiInstance(this.component);
    this.recomputeNumbers();
    if (this.currentMultiInfo.currentCount > 0) {
      const that = this;
      setTimeout(() => {
        that.activeComponentRegistry.updateViewToModel(that.component, that.handlerContext);
      }, 0);
    }
  }

  isEnabledDelete(): boolean {
    if (this.currentMultiInfo.currentCount === 0) {
      return false;
    }
    if (this.component.multiInfo.minItems != null) {
      if (this.currentMultiInfo.currentCount <= this.component.multiInfo.minItems) {
        return false;
      }
    }
    return true;
  }

  isEnabledCopy(): boolean {
    return this.isEnabledAdd();
  }

  isEnabledAdd(): boolean {
    if (this.component.multiInfo.minItems != null) {
      if (this.currentMultiInfo.currentCount >= this.component.multiInfo.maxItems) {
        return false;
      }
    }
    return true;
  }

  updatePagingUI(): void {
    this.recomputeNumbers();
  }

  hasMultiInstances(): boolean {
    return this.currentMultiInfo.currentCount > 0;
  }
}
