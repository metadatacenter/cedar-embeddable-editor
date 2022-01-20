import {TemplateComponent} from './template-component.model';
import {AbstractElementComponent} from '../element/abstract-element-component.model';
import {CedarComponent} from '../component/cedar-component.model';

export class NullTemplate extends AbstractElementComponent implements TemplateComponent {

  className = 'NullTemplate';
  pageBreakChildren: Array<CedarComponent[]>;
  currentPageBreakIndex: number;


  hasPageBreaks(): boolean {
    return false;
  }

  numPages(): number {
    return 0;
  }

  allPageIndices(): number[] {
    return null;
  }

  currentPage(): CedarComponent[] {
    return null;
  }

  currentPageSize(): number {
    return 0;
  }

  page(pageNum: number): CedarComponent[] {
    return null;
  }

  hasPreviousPage(): boolean {
    return false;
  }

  previousPage(): CedarComponent[] {
    return null;
  }

  decrementPage(): void {
  }

  hasNextPage(): boolean {
    return false;
  }

  nextPage(): CedarComponent[] {
    return null;
  }

  incrementPage(): void {
  }

  isMulti(): boolean {
    return false;
  }

  isMultiPage(): boolean {
    return false;
  }

}
