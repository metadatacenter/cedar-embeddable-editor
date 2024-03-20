import { Component, DoCheck, EventEmitter, Input, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { MultiComponent } from '../../models/component/multi-component.model';
import { PageEvent } from '@angular/material/paginator';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { MultiInstanceObjectInfo } from '../../models/info/multi-instance-object-info.model';
import { HandlerContext } from '../../util/handler-context';
import { ComponentTypeHandler } from '../../handler/component-type.handler';
import { JsonSchema } from '../../models/json-schema.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { InputType } from '../../models/input-type.model';
import { TranslateService } from '@ngx-translate/core';
import { MessageHandlerService } from '../../service/message-handler.service';
import { InstanceExtractData } from '../../models/instance-extract-data.model';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { CedarComponent } from '../../models/component/cedar-component.model';

@Component({
  selector: 'app-cedar-multi-pager',
  templateUrl: './cedar-multi-pager.component.html',
  styleUrls: ['./cedar-multi-pager.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CedarMultiPagerComponent implements OnInit, DoCheck {
  static readonly MAX_CHARACTERS_MULTI_VALUE = 30;

  component: MultiComponent;
  currentMultiInfo: MultiInstanceObjectInfo;
  activeComponentRegistry: ActiveComponentRegistryService;
  translateService: TranslateService;
  messageHandlerService: MessageHandlerService;
  @Input() handlerContext: HandlerContext;
  @Input() isAlignedUp: boolean;
  @Input() showAllMultiInstanceValues: boolean;
  @Output() componentsChanged: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Input() pageBreakPaginatorService: PageBreakPaginatorService;
  readOnlyMode;

  length = 0;
  pageSize = 5;
  pageIndex = 0;
  pageSizeOptions: number[] = [1, 2, 5, 10, 25];

  firstIndex = 0;
  lastIndex = -1;
  pageNumbers: number[] = [];
  showPageSizeOptions = false;
  hidePageSize = true;

  multiInstanceValue: string;

  constructor(
    activeComponentRegistry: ActiveComponentRegistryService,
    translateService: TranslateService,
    messageHandlerService: MessageHandlerService,
  ) {
    this.activeComponentRegistry = activeComponentRegistry;
    this.translateService = translateService;
    this.messageHandlerService = messageHandlerService;
  }

  ngOnInit(): void {
    if (this.handlerContext && this.handlerContext.readOnlyMode) {
      this.readOnlyMode = this.handlerContext.readOnlyMode;
    }
    this.recomputeNumbers();
  }

  ngDoCheck(): void {
    this.multiInstanceValue = this.getMultiInstanceDataValueInfo();
  }

  getMultiInstanceDataValueInfo(): string {
    if (!ComponentTypeHandler.isField(this.component)) {
      return '';
    }
    const parentNodeInfo: InstanceExtractData = this.handlerContext.getParentDataObjectNodeByPath(this.component.path);
    const nodeInfo: InstanceExtractData = this.handlerContext.getDataObjectNodeByPath(this.component.path);
    let info = '';
    const infoArray = [];
    const inputType = (this.component as MultiFieldComponent).basicInfo.inputType;
    if (nodeInfo !== null && nodeInfo !== undefined) {
      (nodeInfo as Array<any>).forEach((fieldName, index) => {
        const numStr =
          '<span class="multiinfo-index' +
          (index > 0 ? ' not-first-multiinfo-index' : '') +
          (index === this.currentMultiInfo.currentIndex ? ' current-multiinfo-index' : '') +
          '">' +
          (index + 1) +
          '</span> ';

        if (typeof fieldName === 'string' && fieldName !== '') {
          // attribute-value type input
          infoArray.push(
            numStr + fieldName + '=' + this.shortValue(inputType, parentNodeInfo[fieldName][JsonSchema.atValue]),
          );
        } else if (typeof fieldName === 'object') {
          // all other type inputs
          if (Object.hasOwn(fieldName, JsonSchema.atValue)) {
            infoArray.push(numStr + (this.shortValue(inputType, fieldName[JsonSchema.atValue]) || 'null'));
          } else if (Object.hasOwn(fieldName, JsonSchema.atId) && inputType === InputType.link) {
            // link field
            infoArray.push(numStr + (this.shortValue(inputType, fieldName[JsonSchema.atId]) || 'null'));
          } else if (Object.hasOwn(fieldName, JsonSchema.atId)) {
            // controlled field
            infoArray.push(numStr + (this.shortValue(inputType, fieldName[JsonSchema.rdfsLabel]) || 'null'));
          } else {
            // empty controlled field
            infoArray.push(numStr + 'null');
          }
        }
      });
    } else {
      this.messageHandlerService.error('Missing data in instance:' + this.component.path);
      return '';
    }

    info = infoArray.join('');

    if (info) {
      info = '<b>' + this.translateService.instant('Generic.AllValues') + ':</b> ' + info;
    }
    return info || '';
  }

  @Input() set componentToRender(componentToRender: MultiComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerMultiPagerComponent(this.component, this);
  }

  private shortValue(inputType: string, value: string): string {
    let val = value;

    if (
      value &&
      [InputType.text, InputType.textarea].includes(inputType) &&
      value.length > CedarMultiPagerComponent.MAX_CHARACTERS_MULTI_VALUE
    ) {
      val = value.substr(0, CedarMultiPagerComponent.MAX_CHARACTERS_MULTI_VALUE);
      let ind = CedarMultiPagerComponent.MAX_CHARACTERS_MULTI_VALUE;
      // make sure we cut off on a whole word rather than a fragment
      while (!this.isEmptySpace(value[ind]) && ind < value.length) {
        val += value[ind];
        ind++;
      }

      if (val.trim().length < value.trim().length) {
        val += '...';
      }
    }
    return val;
  }

  private isEmptySpace(text: string): boolean {
    return text == null || text.match(/^\s*$/) !== null;
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
    // this call was causing the entire dateTimeParsed object to reset
    // after the timezone input was set
    // see cedar-input-datetime.component.ts:
    // this.timezone = {
    //   id: this.datetimeParsed.timezoneOffset,
    //   label: this.datetimeParsed.timezoneName
    // };
    // this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
    // nothing has changed, the same page number is clicked
    if (chipIdx === this.currentMultiInfo.currentIndex) {
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

    if (this.currentMultiInfo.currentCount > 0) {
      setTimeout(() => {
        this.activeComponentRegistry.updateViewToModel(this.component, this.handlerContext);
      });
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
    if (this.currentMultiInfo.currentCount === 0) {
      return false;
    }
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

  getInstanceCount(): number {
    return this.currentMultiInfo.currentCount;
  }

  private emitEvent(event: MouseEvent, message: string) {
    const myEvent = new CustomEvent('change', {
      detail: { message: message },
      bubbles: true,
      cancelable: true,
    });
    event.target.dispatchEvent(myEvent);
  }
}
