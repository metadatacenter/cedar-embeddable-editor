import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { catchError } from 'rxjs/operators';
import { MessageHandlerService } from '../service/message-handler.service';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FallbackTranslateLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
    private fallback: object,
  ) {}

  getTranslation(lang: string): Observable<any> {
    this.messageHandlerService.trace('Loading language map:' + lang);
    const httpLoader = new TranslateHttpLoader(this.http, '/assets/i18n-cee/');

    return httpLoader.getTranslation(lang).pipe(
      catchError((err) => {
        this.messageHandlerService.trace('External language map not found, using built-in version.');
        if (Object.hasOwn(this.fallback, lang)) {
          return Promise.resolve(this.fallback[lang]);
        } else {
          return Promise.resolve(null);
        }
      }),
    );
  }
}
