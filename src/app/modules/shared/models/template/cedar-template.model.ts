import {TemplateComponent} from './template-component.model';
import {AbstractElementComponent} from '../element/abstract-element-component.model';
import {CedarComponent} from '../component/cedar-component.model';
import {DataObjectUtil} from '../../util/data-object-util';

export class CedarTemplate extends AbstractElementComponent implements TemplateComponent {

  className = 'CedarTemplate';
  pageBreakChildren: Array<CedarComponent[]>;
  currentPageBreakIndex = 0;


  hasPageBreaks(): boolean {
    return (this.pageBreakChildren.length > 1 && !DataObjectUtil.arraysEqual(this.children, this.pageBreakChildren[0]));
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

  isMulti(): boolean {
    return false;
  }

  isMultiPage(): boolean {
    return false;
  }

}
