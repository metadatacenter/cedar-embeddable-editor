import {Injectable} from '@angular/core';
import {JsonSchema} from '../../models/json-schema.model';
import {HttpClient} from '@angular/common/http';
import {of, Observable, from, Subject, EMPTY} from 'rxjs';
import {catchError, concatMap, map, takeUntil} from 'rxjs/operators';
import {MessageHandlerService} from '../../service/message-handler.service';

@Injectable({
  providedIn: 'root'
})
export class SampleTemplatesService {

  private readonly MAX_CHECK = 500;
  private allTemplates: Observable<object>;


  constructor(private http: HttpClient, private messageHandlerService: MessageHandlerService) {
  }

  getSampleTemplates(templateLocationPrefix: string): Observable<object> {
    if (!this.allTemplates) {
      this.buildAllTemplates(templateLocationPrefix);
    }
    return this.allTemplates;
  }

  private buildAllTemplates(templateLocationPrefix: string): void {
    const allTemplates = {};
    this.getAllTemplatesSubscription(templateLocationPrefix).subscribe(
      resp => {
        Object.assign(allTemplates, resp);
      });
    this.allTemplates = of(allTemplates);
  }

  private getAllTemplatesSubscription(templateLocationPrefix: string): Observable<object> {
    const singleUrls: string[] = [];
    const closeRequest$ = new Subject<boolean>();
    let errorIndex = 0;

    for (let i = 1; i <= this.MAX_CHECK; i++) {
      const templateName = (i < 10) ? '0' + i.toString() : i.toString();
      const templateUrl = templateLocationPrefix + templateName + '/template.json';
      singleUrls.push(templateUrl);
    }
    return from(singleUrls)
      .pipe(
        concatMap(singleUrl => {
          const templateNum = this.templateNumberFromUrl(templateLocationPrefix, singleUrl);
          return this.getSingleTemplate(singleUrl)
            .pipe(
              map ( templateLabel => {
                errorIndex = 0;
                const templateEntry = {};
                templateEntry[templateNum] = 'Template ' + templateNum + ' - ' + templateLabel;
                return templateEntry;
              }),
              // if encounter two consecutive error requests, finish polling
              catchError(error => {
                if (error.status === 0) {
                  errorIndex++;
                } else {
                  this.messageHandlerService.errorObject(error['message'], error);
                }

                if (errorIndex > 1) {
                  closeRequest$.next(null);
                  closeRequest$.complete();
                }
                return EMPTY;
              })
            );
        }),
        takeUntil(closeRequest$)
      );
  }

  private getSingleTemplate(templateUrl: string): Observable<string> {
    return this.http.get(templateUrl)
      .pipe(
        map(response => {
          if (response == null || !response[JsonSchema.schemaName]) {
            return null;
          }
          return response[JsonSchema.schemaName];
        })
      );
  }

  private templateNumberFromUrl(templateLocationPrefix, url): string {
    const templateNumPatternStr = '^' + templateLocationPrefix + '(\\d+)\\/';
    const templateNumPattern = new RegExp(templateNumPatternStr);
    const templateNumMatch = url.match(templateNumPattern);
    return templateNumMatch[1];
  }

}
