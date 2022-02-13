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


  constructor(private http: HttpClient, private messageHandlerService: MessageHandlerService) {
  }

  getSingleTemplate(templateUrl: string): Observable<string> {
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

  getAllTemplates(templateLocationPrefix: string): Observable<object> {
    const singleUrls: string[] = [];
    const closeRequest$ = new Subject<boolean>();
    const allTemplates = {};

    for (let i = 1; i <= this.MAX_CHECK; i++) {
      const templateName = (i < 10) ? '0' + i.toString() : i.toString();
      const templateUrl = templateLocationPrefix + templateName + '/template.json';
      singleUrls.push(templateUrl);
    }

    let errorIndex = 0;

    from(singleUrls)
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
      )
      .subscribe(
        resp => {
          Object.assign(allTemplates, resp);
        }
      );
    return of(allTemplates);
  }

  private templateNumberFromUrl(templateLocationPrefix, url): string {
    const templateNumPatternStr = '^' + templateLocationPrefix + '(\\d{2})\\/';
    const templateNumPattern = new RegExp(templateNumPatternStr);
    const templateNumMatch = url.match(templateNumPattern);
    return templateNumMatch[1];
  }

}
