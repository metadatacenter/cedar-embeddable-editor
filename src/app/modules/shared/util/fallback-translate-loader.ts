import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { MessageHandlerService } from '../service/message-handler.service';
import { GlobalSettingsContextService } from '../service/global-settings-context.service';

/** The built-in maps CEE ships, keyed by language code: `{ en: …, hu: … }`. */
export type BuiltInTranslations = Record<string, TranslationObject>;

export class FallbackTranslateLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
    private globalSettingsContextService: GlobalSettingsContextService,
    private fallback: BuiltInTranslations,
  ) {}

  getTranslation(lang: string): Observable<TranslationObject> {
    const languageMapPathPrefix = this.globalSettingsContextService.languageMapPathPrefix;

    if (languageMapPathPrefix != null) {
      this.messageHandlerService.traceGroup(
        'language',
        'Loading language map from config path: "' + languageMapPathPrefix + '"',
      );
      this.messageHandlerService.traceGroup('language', 'Loading language map: "' + lang + '"');
      // One GET, spelled out rather than delegated: `<prefix><language>.json` is the
      // whole of what the dropped `@ngx-translate/http-loader` did for CEE, and a
      // second package to compose a URL and hand it to the same `HttpClient` earned
      // less than the dependency cost. Whatever JSON is at the path is what the
      // language map is; nothing downstream can check it further, since a map is
      // arbitrary nesting either way.
      return this.http.get<TranslationObject>(`${languageMapPathPrefix}${lang}.json`).pipe(
        tap({
          next: () => {
            this.messageHandlerService.traceGroup('language', 'External language map loaded.');
          },
        }),
        catchError(() => {
          this.messageHandlerService.traceGroup('language', 'External language map not found, using built-in version.');
          return this.getBuiltInVersion(lang);
        }),
      );
    } else {
      this.messageHandlerService.traceGroup(
        'language',
        '"languageMapPathPrefix" not set, using built-in language map.',
      );
      return this.getBuiltInVersion(lang);
    }
  }

  getBuiltInVersion(lang: string): Observable<TranslationObject> {
    if (Object.hasOwn(this.fallback, lang)) {
      this.messageHandlerService.traceGroup('language', 'Using built-in language map for "' + lang + '"');
      return of(this.fallback[lang]);
    } else {
      const defaultLanguage = GlobalSettingsContextService.DEFAULT_LANGUAGE;
      this.messageHandlerService.traceGroup(
        'language',
        'No built-in language map for "' +
          lang +
          '", using default built-in language map for "' +
          defaultLanguage +
          '"',
      );
      return of(this.fallback[defaultLanguage]);
    }
  }
}
