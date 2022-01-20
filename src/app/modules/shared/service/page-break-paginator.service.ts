import {CedarComponent} from '../models/component/cedar-component.model';

export class PageBreakPaginatorService {

  currentPageBreakIndex: number;
  pageBreakChildren: Array<CedarComponent[]>;


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

  currentPage(): CedarComponent[] {
    return this.page(this.currentPageBreakIndex);
  }

  currentPageSize(): number {
    return this.currentPage().length;
  }

  page(pageNum: number): CedarComponent[] {
    if (pageNum >= 0 && pageNum < this.pageBreakChildren.length) {
      this.currentPageBreakIndex = pageNum;
      return this.curPage();
    }
    return null;
  }

  hasPreviousPage(): boolean {
    return (this.currentPageBreakIndex > 0);
  }

  previousPage(): CedarComponent[] {
    if (this.hasPreviousPage()) {
      this.currentPageBreakIndex--;
      return this.curPage();
    }
    return null;
  }

  decrementPage(): void {
    if (this.currentPageBreakIndex > 0) {
      this.currentPageBreakIndex--;
    }
  }

  hasNextPage(): boolean {
    return (this.currentPageBreakIndex < this.pageBreakChildren.length - 1);
  }

  nextPage(): CedarComponent[] {
    if (this.hasNextPage()) {
      this.currentPageBreakIndex++;
      return this.curPage();
    }
    return null;
  }

  incrementPage(): void {
    if (this.currentPageBreakIndex < this.pageBreakChildren.length - 1) {
      this.currentPageBreakIndex++;
    }
  }

  private curPage(): CedarComponent[] {
    return this.pageBreakChildren[this.currentPageBreakIndex];
  }

}
