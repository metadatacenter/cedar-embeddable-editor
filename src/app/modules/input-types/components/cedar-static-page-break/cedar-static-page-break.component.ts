import { Component, Injectable, Input, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { DataContext } from '../../../shared/util/data-context';
import { MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import { PageBreakPaginatorService } from '../../../shared/service/page-break-paginator.service';

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
  @Input() dataContext: DataContext;
  @Input() pageBreakPaginatorService: PageBreakPaginatorService;

  constructor() {}

  paginatorChanged(event: PageEvent): void {
    this.pageBreakPaginatorService.setPageNumberAndGet(event.pageIndex);
  }
}
