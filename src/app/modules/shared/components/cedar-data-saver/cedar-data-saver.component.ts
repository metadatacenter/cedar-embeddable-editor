import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {CedarComponent} from '../../models/component/cedar-component.model';
import {DataContext} from '../../util/data-context';

@Component({
  selector: 'app-cedar-data-saver',
  templateUrl: 'cedar-data-saver.component.html',
  styleUrls: ['./cedar-data-saver.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarDataSaverComponent implements OnInit, OnDestroy {

  private component: CedarComponent;
  @Input() dataContext: DataContext = null;
  showProgress = false;
  showSuccess = false;
  showError = false;
  progressMessage = 'Processing...';
  successMessage = '';
  errorMessage = '';


  constructor() {
  }

  ngOnInit(): void {
  }

  saveTemplate(event): void {

    console.log(JSON.stringify(this.dataContext.instanceFullData));


    this.stopPropagation(event);
  }

  stopPropagation(event): void {
    event.stopPropagation();
  }


  ngOnDestroy(): void {

  }

}
