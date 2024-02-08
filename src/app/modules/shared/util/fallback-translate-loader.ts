import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { catchError, tap } from 'rxjs/operators';
import { MessageHandlerService } from '../service/message-handler.service';
import { Injectable } from '@angular/core';
import { GlobalSettingsContextService } from '../service/global-settings-context.service';

@Injectable({
  providedIn: 'root',
})
export class FallbackTranslateLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
    private globalSettingsContextService: GlobalSettingsContextService,
    private fallback: object,
  ) {}

  getTranslation(lang: string): Observable<any> {
    const languageMapPathPrefix = this.globalSettingsContextService.languageMapPathPrefix;

    if (languageMapPathPrefix != null) {
      this.messageHandlerService.trace('Loading language map from config path: "' + languageMapPathPrefix + '"');
      this.messageHandlerService.trace('Loading language map: "' + lang + '"');
      const httpLoader = new TranslateHttpLoader(this.http, languageMapPathPrefix);
      return httpLoader.getTranslation(lang).pipe(
        tap({
          next: () => {
            this.messageHandlerService.trace('External language map loaded.');
          },
        }),
        catchError(() => {
          this.messageHandlerService.trace('External language map not found, using built-in version.');
          return this.getBuiltInVersion(lang);
        }),
      );
    } else {
      this.messageHandlerService.trace('"languageMapPathPrefix" not set, using built-in language map.');
      return this.getBuiltInVersion(lang);
    }
  }

  getBuiltInVersion(lang: string): Observable<any> {
    if (Object.hasOwn(this.fallback, lang)) {
      this.messageHandlerService.trace('Using built-in language map for "' + lang + '"');
      return of(this.fallback[lang]);
    } else {
      this.messageHandlerService.trace('No built-in language map for "' + lang + '"');
      return of(null);
    }
  }
}
