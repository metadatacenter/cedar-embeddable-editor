import { Component, Injectable, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { DataContext } from '../../../shared/util/data-context';
import { MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import { MatChipSelectionChange } from '@angular/material/chips';
import { PageBreakPaginatorService } from '../../../shared/service/page-break-paginator.service';
import { MATERIAL_TEXT_LANGUAGE } from '../../../shared/a11y/language-tag';
import { moveChipFocus } from '../../../shared/a11y/chip-listbox-keys';

@Injectable()
export class CustomMatPaginatorIntl extends MatPaginatorIntl {
  override getRangeLabel = (_page: number, _pageSize: number, _length: number) => {
    return '';
  };
}

@Component({
  selector: 'app-cedar-static-page-break',
  templateUrl: './cedar-static-page-break.component.html',
  styleUrls: ['./cedar-static-page-break.component.scss'],
  encapsulation: ViewEncapsulation.Emulated,
  providers: [{ provide: MatPaginatorIntl, useClass: CustomMatPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class CedarStaticPageBreakComponent {
  @Input({ required: true }) dataContext!: DataContext;
  @Input({ required: true }) pageBreakPaginatorService!: PageBreakPaginatorService;
  /** The paginator's labels and tooltips are Material's English. */
  readonly materialLanguage = MATERIAL_TEXT_LANGUAGE;
  readonly moveChipFocus = moveChipFocus;

  constructor() {}

  /**
   * The page a user picks from the chips, by pointer, Enter or Space.
   *
   * Only a selection turns the page. Picking the current page's chip again deselects it, as a click
   * on it always has.
   */
  pageChipSelected(event: MatChipSelectionChange, pageNumber: number): void {
    if (event.isUserInput && event.selected) {
      this.pageBreakPaginatorService.setPageNumberAndGet(pageNumber);
    }
  }

  paginatorChanged(event: PageEvent): void {
    this.pageBreakPaginatorService.setPageNumberAndGet(event.pageIndex);
  }
}
