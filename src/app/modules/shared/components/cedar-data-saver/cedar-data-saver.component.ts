import {Component, Input, OnInit, ViewEncapsulation} from '@angular/core';
import {CedarComponent} from '../../models/component/cedar-component.model';
import {DataContext} from '../../util/data-context';

@Component({
  selector: 'app-cedar-data-saver',
  templateUrl: 'cedar-data-saver.component.html',
  styleUrls: ['./cedar-data-saver.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarDataSaverComponent implements OnInit {

  private component: CedarComponent;
  @Input() dataContext: DataContext = null;
  showProgress = true;
  showSuccess = true;
  showError = true;
  progressMessage = 'Processing...';
  successMessage = 'This is great';
  errorMessage = 'That is NOT cool';


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

}
