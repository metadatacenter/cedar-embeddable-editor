import {
  Component,
  DoCheck,
  Input,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MultiComponent } from '../../models/component/multi-component.model';
import { PageEvent } from '@angular/material/paginator';
import { ActiveComponentRegistryService } from '../../service/active-component-registry.service';
import { MultiInstanceObjectInfo } from '../../models/info/multi-instance-object-info.model';
import { HandlerContext } from '../../util/handler-context';
import { ComponentTypeHandler } from '../../handler/component-type.handler';
import { InstanceValueNode } from '../../util/instance-value-node';
import { InstanceNode } from '../../models/instance-node.model';
import { valueIsIri } from '../../models/ext-auth-categories.model';
import { MultiFieldComponent } from '../../models/field/multi-field-component.model';
import { InputType } from '../../models/input-type.model';
import { TranslateService } from '@ngx-translate/core';
import { MessageHandlerService } from '../../service/message-handler.service';
import { InstanceExtractData } from '../../models/instance-extract-data.model';
import { PageBreakPaginatorService } from '../../service/page-break-paginator.service';
import { UserPreferencesService } from '../../service/user-preferences.service';
import { Subscription } from 'rxjs';
import { isInstanceObject } from '../../models/instance-node.model';

@Component({
  selector: 'app-cedar-multi-pager',
  templateUrl: './cedar-multi-pager.component.html',
  styleUrls: ['./cedar-multi-pager.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarMultiPagerComponent implements OnInit, OnDestroy, DoCheck {
  static readonly MAX_CHARACTERS_MULTI_VALUE = 30;

  component!: MultiComponent;
  /** Null until the component is set, and for a component the info tree has no node for. */
  currentMultiInfo: MultiInstanceObjectInfo | null = null;
  activeComponentRegistry: ActiveComponentRegistryService;
  translateService: TranslateService;
  messageHandlerService: MessageHandlerService;
  @Input({ required: true }) handlerContext!: HandlerContext;
  @Input() isAlignedUp = false;
  /** True, for the reason given on the renderer: it is CEE's default, not false. */
  @Input() showAllMultiInstanceValues = true;
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

  /** The "All values" summary. Empty until `ngDoCheck` builds one, and empty for a
   * component that is not a field — which is what `getMultiInstanceDataValueInfo`
   * returns in that case, and what the template treats as nothing to show. */
  multiInstanceValue = '';

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

  ngDoCheck(): void {
    this.multiInstanceValue = this.getMultiInstanceDataValueInfo();
  }

  /**
   * The "All values" summary drawn above a paged field.
   *
   * What each occurrence holds is asked of `InstanceValueNode`, which is the
   * one place that answers it. This used to run its own ladder — `@value`, then
   * `@id` if the field is a link, then `rdfs:label` — and that ladder had no
   * branch for the external authority types, which hold their value in `@id`
   * exactly as a link does. A filled ORCID or ROR occurrence fell through to
   * `rdfs:label`, found nothing, and drew "null" over a field the user had just
   * filled in. The same omission in the quality report made a required ORCID
   * field impossible to satisfy; it was fixed there and missed here.
   */
  getMultiInstanceDataValueInfo(): string {
    if (!ComponentTypeHandler.isField(this.component)) {
      return '';
    }
    const parentNodeInfo: InstanceExtractData = this.handlerContext.getParentDataObjectNodeByPath(this.component.path);
    const nodeInfo: InstanceExtractData = this.handlerContext.getDataObjectNodeByPath(this.component.path);
    let info = '';
    const infoArray: string[] = [];
    // `?? ''` so a field with no declared input type is simply not IRI-valued,
    // which is what it was before the type said the declaration can be absent.
    const inputType = (this.component as MultiFieldComponent).basicInfo.inputType ?? '';
    const iriValued = valueIsIri(inputType as InputType);
    if (nodeInfo !== null && nodeInfo !== undefined) {
      // `unknown[]`, not `any[]`: an occurrence is either the value node itself or,
      // for attribute-value fields, the *name* under which the parent holds it. The
      // code below already distinguishes them by `typeof`, so the element type is
      // honestly unknown and the narrowing is what decides.
      (nodeInfo as unknown[]).forEach((fieldName, index) => {
        const numStr =
          '<span class="multiinfo-index' +
          (index > 0 ? ' not-first-multiinfo-index' : '') +
          (index === this.currentMultiInfo?.currentIndex ? ' current-multiinfo-index' : '') +
          '">' +
          (index + 1) +
          '</span> ';

        // An attribute-value occurrence *is* its own name; the value it names
        // sits on the parent under that name. Every other kind of occurrence is
        // the value node itself.
        //
        // Held as a nullable name rather than a boolean so the narrowing survives:
        // a separate `isAttributeValue` flag tells TypeScript nothing about
        // `fieldName`, and every use below would need a cast back to string.
        const attributeName = typeof fieldName === 'string' && fieldName !== '' ? fieldName : null;
        if (attributeName === null && typeof fieldName !== 'object') {
          return;
        }
        // The name itself when there is no attribute to look up: a slot with no
        // name shows the label the pager already has.
        const node: InstanceNode | null =
          attributeName !== null && isInstanceObject(parentNodeInfo)
            ? parentNodeInfo.values[attributeName] ?? null
            : InstanceValueNode.literalValue(typeof fieldName === 'string' ? fieldName : null);
        const shown = this.shortValue(inputType, InstanceValueNode.plainValue(node, iriValued));
        infoArray.push(numStr + (attributeName !== null ? attributeName + '=' : '') + (shown ?? 'null'));
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

  @Input({ required: true }) set componentToRender(componentToRender: MultiComponent) {
    this.component = componentToRender;
    this.activeComponentRegistry.registerMultiPagerComponent(this.component, this);
  }

  /*
   * Null passes straight through, and that matters: the caller turns it into the
   * literal "null" that the pager shows for an unfilled occurrence. Folding it to
   * an empty string here made that fallback unreachable, and `pager-labels` said so.
   */
  private shortValue(inputType: string, value: string | null): string | null {
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
