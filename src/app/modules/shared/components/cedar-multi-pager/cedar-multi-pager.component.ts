import { Component, Input, OnDestroy, OnInit, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { MultiComponent } from '../../models/component/multi-component.model';
import { PageEvent } from '@angular/material/paginator';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { MultiInstanceObjectInfo } from '../../models/info/multi-instance-object-info.model';
import { HandlerContext } from '../../util/handler-context';
import { TranslateService } from '@ngx-translate/core';
import { MessageHandlerService } from '../../service/message-handler.service';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cedar-multi-pager',
  templateUrl: './cedar-multi-pager.component.html',
  styleUrls: ['./cedar-multi-pager.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarMultiPagerComponent implements OnInit, OnDestroy {
  component!: MultiComponent;
  /** Null until the component is set, and for a component the info tree has no node for. */
  currentMultiInfo: MultiInstanceObjectInfo | null = null;
  activeComponentRegistry: ActiveComponentRegistryService;
  translateService: TranslateService;
  messageHandlerService: MessageHandlerService;
  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input() isAlignedUp = false;
  @Input({ required: true }) pageBreakPaginatorService!: PageBreakPaginatorService;
  readOnlyMode = false;
  readOnlModeSubscription: Subscription = Subscription.EMPTY;
  userPreferencesService: UserPreferencesService;

  length = 0;
  pageSize = 5;
  pageIndex = 0;
  pageSizeOptions: number[] = [1, 2, 5, 10, 25];

  firstIndex = 0;
  lastIndex = -1;
  pageNumbers: number[] = [];
  showPageSizeOptions = false;
  hidePageSize = true;

  constructor(
    activeComponentRegistry: ActiveComponentRegistryService,
    translateService: TranslateService,
    messageHandlerService: MessageHandlerService,
    userPreferencesService: UserPreferencesService,
  ) {
    this.activeComponentRegistry = activeComponentRegistry;
    this.translateService = translateService;
    this.messageHandlerService = messageHandlerService;
    this.userPreferencesService = userPreferencesService;
  }

  ngOnInit(): void {
    this.readOnlModeSubscription = this.userPreferencesService.readOnlyMode$.subscribe((value) => {
      this.readOnlyMode = value;
    });
    this.recomputeNumbers();
  }

  ngOnDestroy(): void {
    this.readOnlModeSubscription.unsubscribe();
    this.activeComponentRegistry.unregisterMultiPagerComponent(this.component, this);
  }

  @Input({ required: true }) set componentToRender(componentToRender: MultiComponent) {
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
      this.currentMultiInfo = this.handlerContext.multiInstanceObjectService.getMultiInstanceInfoForComponent(
        this.component,
      );
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
    this.handlerContext.setCurrentIndex(this.component, this.firstIndex);
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
    // Page zero with no info node: the pager has nothing to page through, which is
    // the same position it starts in.
    this.pageIndex = Math.floor((this.currentMultiInfo?.currentIndex ?? 0) / this.pageSize);
    this.firstIndex = this.pageIndex * this.pageSize;
  }

  private computeLastIndex(): void {
    this.length = this.currentMultiInfo?.currentCount ?? 0;
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
    // this call was causing the entire dateTimeParsed object to reset
    // after the timezone input was set
    // see cedar-input-datetime.component.ts:
    // this.timezone = {
    //   id: this.datetimeParsed.timezoneOffset,
    //   label: this.datetimeParsed.timezoneName
    // };
    // this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
    // nothing has changed, the same page number is clicked
    if (chipIdx === (this.currentMultiInfo?.currentIndex ?? 0)) {
      return;
    }
    this.handlerContext.setCurrentIndex(this.component, chipIdx);
    if (this.handlerContext.hideEmptyFields) {
      this.activeComponentRegistry.setVisibility(this.component, this.handlerContext);
    }
    this.recomputeNumbers();
    setTimeout(() => {
      this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
    });
  }

  clickedAdd(event: MouseEvent): void {
    this.handlerContext.addMultiInstance(this.component);
    this.recomputeNumbers();
    // The component will be null if the count was 0 before
    // We need to wait for it to be available
    setTimeout(() => {
      this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
      this.emitEvent(event, 'multiInstanceAdded');
    });
  }

  clickedCopy(event: MouseEvent): void {
    this.handlerContext.copyMultiInstance(this.component);
    this.recomputeNumbers();
    setTimeout(() => {
      this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
      this.emitEvent(event, 'multiInstanceCopied');
    });
  }

  clickedDelete(event: MouseEvent): void {
    this.handlerContext.deleteMultiInstance(this.component);
    this.recomputeNumbers();

    setTimeout(() => {
      this.activeComponentRegistry.deleteCurrentValue(this.component);
      this.emitEvent(event, 'multiInstanceDeleted');
    });

    if ((this.currentMultiInfo?.currentCount ?? 0) > 0) {
      setTimeout(() => {
        this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
      });
    }
  }

  isEnabledDelete(): boolean {
    if ((this.currentMultiInfo?.currentCount ?? 0) === 0) {
      return false;
    }
    if (this.component.multiInfo.minItems != null) {
      if ((this.currentMultiInfo?.currentCount ?? 0) <= this.component.multiInfo.minItems) {
        return false;
      }
    }
    return true;
  }

  isEnabledCopy(): boolean {
    if ((this.currentMultiInfo?.currentCount ?? 0) === 0) {
      return false;
    }
    return this.isEnabledAdd();
  }

  isEnabledAdd(): boolean {
    // Guards on maxItems, which is what the comparison uses. It previously
    // guarded on minItems, so a field declaring an upper bound without a lower
    // one never disabled the add button and the bound went unenforced.
    if (this.component.multiInfo.maxItems != null) {
      if ((this.currentMultiInfo?.currentCount ?? 0) >= this.component.multiInfo.maxItems) {
        return false;
      }
    }
    return true;
  }

  updatePagingUI(): void {
    this.recomputeNumbers();
  }

  hasMultiInstances(): boolean {
    return (this.currentMultiInfo?.currentCount ?? 0) > 0;
  }

  getInstanceCount(): number {
    return this.currentMultiInfo?.currentCount ?? 0;
  }

  private emitEvent(event: MouseEvent, message: string) {
    const myEvent = new CustomEvent('change', {
      detail: { message: message },
      bubbles: true,
      cancelable: true,
    });
    event.target?.dispatchEvent(myEvent);
  }
}
