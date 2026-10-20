import { Component, Injectable, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { DataContext } from '../../../shared/util/data-context';
import { MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import { PageBreakPaginatorService } from '../../../shared/service/page-break-paginator.service';
import { MATERIAL_TEXT_LANGUAGE } from '../../../shared/util/language-tag';

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

  constructor() {}

  paginatorChanged(event: PageEvent): void {
    this.pageBreakPaginatorService.setPageNumberAndGet(event.pageIndex);
  }
}
