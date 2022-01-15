import {Component, Input, OnDestroy, OnInit, ViewEncapsulation} from '@angular/core';
import {DataContext} from '../../util/data-context';
import {HttpClient, HttpHeaders, HttpParams, HttpRequest, HttpResponse} from '@angular/common/http';
import {Observable, Subscription} from 'rxjs';
import {MessageHandlerService} from '../../service/message-handler.service';

@Component({
  selector: 'app-cedar-data-saver',
  templateUrl: 'cedar-data-saver.component.html',
  styleUrls: ['./cedar-data-saver.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class CedarDataSaverComponent implements OnInit, OnDestroy {

  // Number of milliseconds to display the submission success message
  private static readonly SUCCESS_MESSAGE_TIMEOUT = 5000;
  private static readonly PARAM_ID = 'id';
  private static readonly PARAM_TITLE = 'title';

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


  constructor(private httpClient: HttpClient, private messageHandlerService: MessageHandlerService) {
  }

  ngOnInit(): void {
  }

  saveTemplate(event): void {
    this.httpPostSubscription.add(
      this.httpRequest().subscribe(
        (data: any) => {
          if (data instanceof HttpResponse) {
            this.clearProgress();
            this.clearError();
            this.showSuccess = true;
            this.successMessage = 'Metadata saved successfully';

            if (data['body'][CedarDataSaverComponent.PARAM_ID]) {
              this.dataContext.savedTemplateID = data['body'][CedarDataSaverComponent.PARAM_ID];
            }
            this.messageHandlerService.traceObject('Data received from the server:', data);
          } else {
            this.clearSuccess();
            this.clearError();
            this.showProgress = true;
          }
        },
        (error: any) => {
          this.clearProgress();
          this.clearSuccess();
          this.showError = true;
          this.errorMessage = 'Error saving metadata';

          if (typeof error === 'object' && error.hasOwnProperty('message')) {
            this.messageHandlerService.error(error['message']);
          }
        },
        () => {
          // remove success message in SUCCESS_MESSAGE_TIMEOUT seconds (
          if (this.showSuccess) {
            setTimeout(() => {
              this.clearSuccess();
            }, CedarDataSaverComponent.SUCCESS_MESSAGE_TIMEOUT);
          }
        }
      )
    );
    this.stopPropagation(event);
  }

  private httpRequest(): Observable<any> {
    const body = this.dataContext.instanceFullData;
    const httpHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    let method = 'POST';
    this.httpRequestParams = {};
    this.httpRequestParams[CedarDataSaverComponent.PARAM_TITLE] = this.dataContext.templateRepresentation.labelInfo.label;

    if (this.dataContext.savedTemplateID) {
      method = 'PUT';
      this.httpRequestParams[CedarDataSaverComponent.PARAM_ID] = this.dataContext.savedTemplateID;
    }
    return this.httpClient.request(method, this.endpointUrl, {
      body,
      headers: httpHeaders,
      observe: 'events',
      params: this.httpRequestParams,
      reportProgress: true,
      responseType: 'json',
    });
  }

  clearProgress(): void {
    this.showProgress = false;
  }

  clearSuccess(): void {
    this.showSuccess = false;
    this.successMessage = '';
  }

  clearError(): void {
    this.showError = false;
    this.errorMessage = '';
  }

  stopPropagation(event): void {
    event.stopPropagation();
  }

  ngOnDestroy(): void {
    this.httpPostSubscription.unsubscribe();
  }

}
