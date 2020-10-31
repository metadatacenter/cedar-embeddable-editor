import {Component, Input, OnInit} from '@angular/core';
import {MultiComponent} from '../../models/component/multi-component.model';
import {PageEvent} from '@angular/material/paginator';
import {DataObjectService} from '../../service/data-object.service';
import {ActiveComponentRegistryService} from '../../service/active-component-registry.service';
import {MultiInstanceObjectService} from '../../service/multi-instance-object.service';

@Component({
  selector: 'app-cedar-multi-pager',
  templateUrl: './cedar-multi-pager.component.html',
  styleUrls: ['./cedar-multi-pager.component.scss']
})
export class CedarMultiPagerComponent implements OnInit {

  component: MultiComponent;
  activeComponentRegistry: ActiveComponentRegistryService;
  @Input() dataObjectService: DataObjectService;
  @Input() multiInstanceObjectService: MultiInstanceObjectService;

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
  }

  @Input() set componentToRender(componentToRender: MultiComponent) {
    this.component = componentToRender;
    if (this.component != null) {
      this.firstIndex = 0;
      this.computeLastIndex();
      this.updatePageNumber();
    }
  }

  pageChanged($event: PageEvent): void {
    this.pageSize = $event.pageSize;
    this.firstIndex = $event.pageIndex * $event.pageSize;
    this.component.setCurrentMultiCount(this.firstIndex);
    this.activeComponentRegistry.updateViewToModel(this.component, this.dataObjectService);
    this.multiInstanceObjectService.setCurrentIndex(this.component, this.firstIndex);
    this.computeLastIndex();
    this.updatePageNumber();
  }

  private updatePageNumber(): void {
    this.pageNumbers = [];
    for (let idx = this.firstIndex; idx <= this.lastIndex; idx++) {
      this.pageNumbers.push(idx);
    }
  }

  private computeLastIndex(): void {
    this.length = this.component.getCurrentMultiCount();
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
    this.component.setCurrentMultiCount(chipIdx);
    this.activeComponentRegistry.updateViewToModel(this.component, this.dataObjectService);
    this.multiInstanceObjectService.setCurrentIndex(this.component, chipIdx);
  }

  clickedAdd(): void {
    this.dataObjectService.multiInstanceItemAdd(this.component);
    this.multiInstanceObjectService.multiInstanceItemAdd(this.component);
    this.computeLastIndex();
    this.updatePageNumber();
    this.component.setCurrentMultiCount(this.component.currentMultiInfo.currentIndex);
    const that = this;
    // The component will be null if the count was 0 before
    // We need to wait for it to be available
    setTimeout(() => {
      that.activeComponentRegistry.updateViewToModel(that.component, that.dataObjectService);
    }, 0);
  }

  clickedCopy(): void {
    this.dataObjectService.multiInstanceItemCopy(this.component);
    this.multiInstanceObjectService.multiInstanceItemCopy(this.component);
    this.computeLastIndex();
    this.updatePageNumber();
    this.component.setCurrentMultiCount(this.component.currentMultiInfo.currentIndex);
    this.activeComponentRegistry.updateViewToModel(this.component, this.dataObjectService);
  }

  clickedDelete(): void {
    this.dataObjectService.multiInstanceItemDelete(this.component);
    this.multiInstanceObjectService.multiInstanceItemDelete(this.component);
    this.computeLastIndex();
    this.updatePageNumber();
    this.component.setCurrentMultiCount(this.component.currentMultiInfo.currentIndex);
    if (this.component.currentMultiInfo.count > 0) {
      this.activeComponentRegistry.updateViewToModel(this.component, this.dataObjectService);
    }
  }

  isEnabledDelete(): boolean {
    if (this.component.currentMultiInfo.count === 0) {
      return false;
    }
    if (this.component.multiInfo.minItems != null) {
      if (this.component.currentMultiInfo.count <= this.component.multiInfo.minItems) {
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
      if (this.component.currentMultiInfo.count >= this.component.multiInfo.maxItems) {
        return false;
      }
    }
    return true;
  }
}
