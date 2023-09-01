import {CedarComponent} from '../models/component/cedar-component.model';
import {ActiveComponentRegistryService} from './active-component-registry.service';
import {HandlerContext} from '../util/handler-context';

export class PageBreakPaginatorService {

  currentPageBreakIndex: number;
  pageBreakChildren: Array<CedarComponent[]>;


  constructor(
      private activeComponentRegistry: ActiveComponentRegistryService,
      private handlerContext: HandlerContext
  ) {
  }

  reset(pbChildren: Array<CedarComponent[]>): void {
    this.pageBreakChildren = pbChildren;
    this.currentPageBreakIndex = 0;
  }

  numPages(): number {
    return this.pageBreakChildren.length;
  }

  allPageIndices(): number[] {
    return this.pageBreakChildren.map((_, i) => i);
  }

  getCurrentPage(): CedarComponent[] {
    return this.pageBreakChildren[this.currentPageBreakIndex];
  }

  setPageNumberAndGet(pageNum: number): CedarComponent[] {
    if (pageNum >= 0 && pageNum < this.pageBreakChildren.length) {
      this.currentPageBreakIndex = pageNum;
      setTimeout(() => {
        for (const childComponent of this.getCurrentPage()) {
          this.activeComponentRegistry.updateViewToModel(childComponent, this.handlerContext);
        }
      });
      return this.getCurrentPage();
    }
    return null;
  }

  // hasPreviousPage(): boolean {
  //   return (this.currentPageBreakIndex > 0);
  // }

  // goToAndGetPreviousPage(): CedarComponent[] {
  //   if (this.hasPreviousPage()) {
  //     this.currentPageBreakIndex--;
  //     return this.getCurrentPage();
  //   }
  //   return null;
  // }

  // decrementPage(): void {
  //   if (this.currentPageBreakIndex > 0) {
  //     this.currentPageBreakIndex--;
  //   }
  // }

  // hasNextPage(): boolean {
  //   return (this.currentPageBreakIndex < this.pageBreakChildren.length - 1);
  // }

  // goToAndGetNextPage(): CedarComponent[] {
  //   if (this.hasNextPage()) {
  //     this.currentPageBreakIndex++;
  //     return this.getCurrentPage();
  //   }
  //   return null;
  // }
  //
  // incrementPage(): void {
  //   if (this.currentPageBreakIndex < this.pageBreakChildren.length - 1) {
  //     this.currentPageBreakIndex++;
  //   }
  // }
}
