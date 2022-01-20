import {ElementComponent} from '../component/element-component.model';
import {CedarComponent} from '../component/cedar-component.model';
import {DataObjectUtil} from '../../util/data-object-util';

// tslint:disable-next-line:no-empty-interface
export interface TemplateComponent extends ElementComponent {

  pageBreakChildren: Array<CedarComponent[]>;
  currentPageBreakIndex: number;


  hasPageBreaks(): boolean;
  numPages(): number;
  allPageIndices(): number[];
  currentPage(): CedarComponent[];
  currentPageSize(): number;
  page(pageNum: number): CedarComponent[];
  hasPreviousPage(): boolean;
  previousPage(): CedarComponent[];
  decrementPage(): void;
  hasNextPage(): boolean;
  nextPage(): CedarComponent[];
  incrementPage(): void;

}
