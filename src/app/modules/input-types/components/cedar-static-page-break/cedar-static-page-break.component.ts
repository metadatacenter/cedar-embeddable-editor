import { Component, Injectable, Input, ViewEncapsulation, ChangeDetectionStrategy, Optional } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TranslateService } from '@ngx-translate/core';
import { DataContext } from '../../../shared/util/data-context';
import { MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import { MatChipSelectionChange } from '@angular/material/chips';
import { PageBreakPaginatorService } from '../../../shared/service/page-break-paginator.service';
import { MATERIAL_TEXT_LANGUAGE } from '../../../shared/a11y/language-tag';
import { moveChipFocus } from '../../../shared/a11y/chip-listbox-keys';
import { announceChange } from '../../../shared/a11y/message-links';

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

  // The element's own announcer, which speaks through the live region in its shadow root. Both are
  // optional, so a spec can build the component without them.
  constructor(
    @Optional() private readonly translate: TranslateService | null = null,
    @Optional() private readonly announcer: LiveAnnouncer | null = null,
  ) {}

  /**
   * The page a user picks from the chips, by pointer, Enter or Space.
   *
   * Only a selection turns the page. Picking the current page's chip again deselects it, as a click
   * on it always has.
   */
  pageChipSelected(event: MatChipSelectionChange, pageNumber: number): void {
    if (event.isUserInput && event.selected) {
      this.turnTo(pageNumber);
    }
  }

  paginatorChanged(event: PageEvent): void {
    this.turnTo(event.pageIndex);
  }

  /**
   * Turn to a page and say which it is. The form below the chips changes without a word otherwise,
   * and focus stays on the control that turned it.
   */
  private turnTo(pageNumber: number): void {
    const service = this.pageBreakPaginatorService;
    const before = service.currentPageBreakIndex;
    if (
      service.setPageNumberAndGet(pageNumber) !== null &&
      service.currentPageBreakIndex !== before &&
      this.translate
    ) {
      announceChange(
        this.announcer,
        this.translate.instant('Generic.PageOf', { number: pageNumber + 1, count: service.numPages() }),
      );
    }
  }
}
