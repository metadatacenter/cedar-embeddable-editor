import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {DataContext} from '../../util/data-context';
import {HttpClient, HttpHeaders, HttpParams, HttpResponse} from '@angular/common/http';
import {Observable, Subscription} from 'rxjs';

@Component({
  selector: 'app-cedar-data-saver',
  templateUrl: 'cedar-data-saver.component.html',
  styleUrls: ['./cedar-data-saver.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarDataSaverComponent implements OnInit, OnDestroy {

  // Number of milliseconds to display the submission success message
  private static readonly SUCCESS_MESSAGE_TIMEOUT = 5000;

  @Input() dataContext: DataContext = null;
  @Input() endpointUrl: string = null;
  httpRequestParams: | HttpParams | { [param: string]: string | string[]; };
  httpPostSubscription = new Subscription();

  showProgress = false;
  showSuccess = false;
  showError = false;
  progressMessage = 'Processing...';
  successMessage = '';
  errorMessage = '';


  constructor(private httpClient: HttpClient) {
  }

  ngOnInit(): void {
  }

  saveTemplate(event): void {
    this.httpPostSubscription.add(
      this.httpPost().subscribe(
        (data: any) => {
          if (data instanceof HttpResponse) {
            this.showProgress = false;
            this.showSuccess = true;
            this.showError = false;
            this.successMessage = 'JSON-LD submitted successfully';


            console.log('Data received from the server:');
            console.log(data);


          } else {
            this.showProgress = true;
            this.showSuccess = false;
            this.showError = false;
          }
        },
        (error: any) => {
          this.showProgress = false;
          this.showSuccess = false;
          this.showError = true;
          this.errorMessage = 'JSON-LD submission failed';

          if (typeof error === 'object' && error.hasOwnProperty('message')) {
            this.errorMessage += ' with an error: ' + error['message'];
          }
        },
        () => {
          // remove success message in SUCCESS_MESSAGE_TIMEOUT seconds (
          if (this.showSuccess) {
            setTimeout(() => {
              this.showSuccess = false;
              this.successMessage = '';
            }, CedarDataSaverComponent.SUCCESS_MESSAGE_TIMEOUT);
          }
        }
      )
    );
    this.stopPropagation(event);
  }

  private httpPost(): Observable<any> {
    const body = this.dataContext.instanceFullData;
    const httpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    return this.httpClient.post(this.endpointUrl, body, {
      headers: httpHeaders,
      observe: 'events',
      params: this.httpRequestParams,
      reportProgress: true,
      responseType: 'json',
    });
  }

  stopPropagation(event): void {
    event.stopPropagation();
  }

  ngOnDestroy(): void {
    this.httpPostSubscription.unsubscribe();
  }

}
