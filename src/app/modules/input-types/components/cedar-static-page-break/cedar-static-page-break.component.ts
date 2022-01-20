import {Component, Injectable, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {DataContext} from '../../../shared/util/data-context';
import {MatPaginatorIntl} from '@angular/material/paginator';
import {Subscription} from 'rxjs';
import {TemplateComponent} from '../../../shared/models/template/template-component.model';

@Injectable()
export class CustomMatPaginatorIntl extends MatPaginatorIntl {
  getRangeLabel = (page: number, pageSize: number, length: number) => {
    return '';
  }
}

@Component({
  selector: 'app-cedar-static-page-break',
  templateUrl: './cedar-static-page-break.component.html',
  styleUrls: ['./cedar-static-page-break.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [{provide: MatPaginatorIntl, useClass: CustomMatPaginatorIntl}]
})
export class CedarStaticPageBreakComponent implements OnInit, OnDestroy {

  @Input() dataContext: DataContext;
  templateRepresentation: TemplateComponent = null;
  templateRepresentationSubscription: Subscription;


  constructor() {
  }

  ngOnInit(): void {
    this.templateRepresentationSubscription = this.dataContext.templateRepresentation$.subscribe(templateRep => {
      this.templateRepresentation = templateRep;
    });
  }

  paginatorChanged(event): void {
    this.templateRepresentation.page(event.pageIndex);
  }

  ngOnDestroy(): void {
    // prevent memory leak when component is destroyed
    this.templateRepresentationSubscription.unsubscribe();
  }

}


