import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  ViewEncapsulation,
} from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MultiComponent } from '../../models/component/multi-component.model';
import { PageEvent } from '@angular/material/paginator';
import { MatChipSelectionChange } from '@angular/material/chips';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { MultiInstanceObjectInfo } from '../../models/info/multi-instance-object-info.model';
import { HandlerContext } from '../../util/handler-context';
import { TranslateService } from '@ngx-translate/core';
import { MessageHandlerService } from '../../service/message-handler.service';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { RenderSchedulerService } from '../../service/render-scheduler.service';
import { MATERIAL_TEXT_LANGUAGE } from '../../a11y/language-tag';
import { moveChipFocus } from '../../a11y/chip-listbox-keys';
import { announceChange } from '../../a11y/message-links';
import { renderingLabelOf } from '../../service/component-data.service';

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
  /** The paginator's labels, tooltips and range are Material's English. */
  readonly materialLanguage = MATERIAL_TEXT_LANGUAGE;

  constructor(
    activeComponentRegistry: ActiveComponentRegistryService,
    translateService: TranslateService,
    messageHandlerService: MessageHandlerService,
    userPreferencesService: UserPreferencesService,
    private renderScheduler: RenderSchedulerService,
    private readonly destroyRef: DestroyRef,
    // The element's own announcer, which speaks through the live region in its shadow root. Optional,
    // so a spec can build the pager without one.
    @Optional() private readonly announcer: LiveAnnouncer | null = null,
  ) {
    this.activeComponentRegistry = activeComponentRegistry;
    this.translateService = translateService;
    this.messageHandlerService = messageHandlerService;
    this.userPreferencesService = userPreferencesService;
  }

  ngOnInit(): void {
    this.userPreferencesService.readOnlyMode$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.readOnlyMode = value;
    });
    this.recomputeNumbers();
  }

  ngOnDestroy(): void {
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
    // The occurrence on screen changed with the page, and the chips do not say so.
    this.announce('Multi.InstanceShown', this.firstIndex + 1);
    this.scheduleViewSync();
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

  chipSelected(event: MatChipSelectionChange, chipIdx: number): void {
    if (!event.isUserInput) return;
    // A pager always has a current occurrence; activating it again cannot deselect it.
    if (!event.selected) event.source.select();
    this.chipClicked(chipIdx);
  }

  chipKeydown(event: KeyboardEvent): void {
    moveChipFocus(event);
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
    this.recomputeNumbers();
    this.scheduleViewSync();
  }

  clickedAdd(): void {
    const added = this.handlerContext.addMultiInstance(this.component);
    this.recomputeNumbers();
    if (added) this.announce('Multi.InstanceAdded');
    this.scheduleViewSync();
  }

  clickedCopy(): void {
    const added = this.handlerContext.copyMultiInstance(this.component);
    this.recomputeNumbers();
    if (added) this.announce('Multi.InstanceCopied');
    this.scheduleViewSync();
  }

  clickedDelete(): void {
    const deleted = (this.currentMultiInfo?.currentIndex ?? 0) + 1;
    if (!this.handlerContext.deleteMultiInstance(this.component)) return;
    this.recomputeNumbers();
    this.announce('Multi.InstanceDeleted', deleted);
    this.scheduleAfterRender(() => {
      this.activeComponentRegistry.deleteCurrentValue(this.component);
      if ((this.currentMultiInfo?.currentCount ?? 0) > 0) {
        this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
      }
    });
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

  /**
   * Say what an add, copy, delete or page turn did, which nothing on screen announces: the
   * occurrence it concerns, by number, and how many there are now. Focus stays where it is.
   */
  private announce(key: string, number = (this.currentMultiInfo?.currentIndex ?? 0) + 1): void {
    announceChange(
      this.announcer,
      this.translateService.instant(key, {
        label: renderingLabelOf(this.component),
        number,
        count: this.getInstanceCount(),
      }),
    );
  }

  private scheduleViewSync(): void {
    this.scheduleAfterRender(() => this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext));
  }

  private scheduleAfterRender(task: () => void): void {
    void this.renderScheduler
      .schedule(task)
      .catch((error) =>
        this.messageHandlerService.error(
          `Multi-instance render failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }
}
