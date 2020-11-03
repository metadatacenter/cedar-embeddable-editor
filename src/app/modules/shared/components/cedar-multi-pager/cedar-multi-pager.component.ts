import {Component, Input, OnInit} from '@angular/core';
import {MultiComponent} from '../../models/component/multi-component.model';
import {PageEvent} from '@angular/material/paginator';
import {DataObjectService} from '../../service/data-object.service';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';
import {MultiInstanceObjectService} from '../../service/multi-instance-object.service';
import {MultiInstanceObjectInfo} from '../../models/info/multi-instance-object-info.model';

@Component({
  selector: 'app-cedar-multi-pager',
  templateUrl: './cedar-multi-pager.component.html',
  styleUrls: ['./cedar-multi-pager.component.scss']
})
export class CedarMultiPagerComponent implements OnInit {

  component: MultiComponent;
  currentMultiInfo: MultiInstanceObjectInfo;
  activeComponentRegistry: ActiveComponentRegistryService;
  multiInstanceService: MultiInstanceObjectService;
  @Input() dataObjectService: DataObjectService;

  length = 0;
  pageSize = 5;
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

  @Input() set multiInstanceObjectService(multiInstanceObjectService: MultiInstanceObjectService) {
    this.multiInstanceService = multiInstanceObjectService;
  }

  private recomputeNumbers(): void {
    this.setCurrentMultiInfo();
    this.firstIndex = 0;
    this.computeLastIndex();
    this.updatePageNumbers();
  }

  private setCurrentMultiInfo(): void {
    if (this.component != null && this.multiInstanceService != null) {
      this.currentMultiInfo = this.multiInstanceService.getMultiInstanceInfoForComponent(this.component);
    }
  }

  pageChanged($event: PageEvent): void {
    this.pageSize = $event.pageSize;
    this.firstIndex = $event.pageIndex * $event.pageSize;
    this.multiInstanceService.setCurrentIndex(this.component, this.firstIndex);
    this.activeComponentRegistry.updateViewToModel(this.component, this.dataObjectService, this.multiInstanceService);
    this.computeLastIndex();
    this.updatePageNumbers();
  }

  private updatePageNumbers(): void {
    this.pageNumbers = [];
    for (let idx = this.firstIndex; idx <= this.lastIndex; idx++) {
      this.pageNumbers.push(idx);
    }
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
    this.activeComponentRegistry.updateViewToModel(this.component, this.dataObjectService, this.multiInstanceService);
    this.multiInstanceService.setCurrentIndex(this.component, chipIdx);
    this.recomputeNumbers();
    const that = this;
    setTimeout(() => {
      that.activeComponentRegistry.updateViewToModel(that.component, that.dataObjectService, this.multiInstanceService);
    }, 0);
  }

  clickedAdd(): void {
    this.dataObjectService.multiInstanceItemAdd(this.component);
    this.multiInstanceService.multiInstanceItemAdd(this.component);
    this.recomputeNumbers();
    const that = this;
    // The component will be null if the count was 0 before
    // We need to wait for it to be available
    setTimeout(() => {
      that.activeComponentRegistry.updateViewToModel(that.component, that.dataObjectService, that.multiInstanceService);
    }, 0);
  }

  clickedCopy(): void {
    this.dataObjectService.multiInstanceItemCopy(this.component);
    this.multiInstanceService.multiInstanceItemCopy(this.component);
    this.recomputeNumbers();
    const that = this;
    setTimeout(() => {
      that.activeComponentRegistry.updateViewToModel(that.component, that.dataObjectService, that.multiInstanceService);
    }, 0);
  }

  clickedDelete(): void {
    this.dataObjectService.multiInstanceItemDelete(this.component);
    this.multiInstanceService.multiInstanceItemDelete(this.component);
    this.recomputeNumbers();
    if (this.currentMultiInfo.currentCount > 0) {
      const that = this;
      setTimeout(() => {
        that.activeComponentRegistry.updateViewToModel(that.component, that.dataObjectService, that.multiInstanceService);
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
