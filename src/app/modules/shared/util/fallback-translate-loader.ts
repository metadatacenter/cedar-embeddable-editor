import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { catchError, map, tap } from 'rxjs/operators';
import { MessageHandlerService } from '../service/message-handler.service';
import { GlobalSettingsContextService } from '../service/global-settings-context.service';

/**
 * A language map, in the shape ngx-translate consumes: keys nested down to strings.
 *
 * Declared here because ngx-translate 14 does not export a type for it — its
 * `TranslateLoader` says `Observable<any>`. A loader may return something narrower
 * than the interface promises, so this does.
 */
export type TranslationMap = { [key: string]: string | TranslationMap };

/** The built-in maps CEE ships, keyed by language code: `{ en: …, hu: … }`. */
export type BuiltInTranslations = Record<string, TranslationMap>;

export class FallbackTranslateLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    private messageHandlerService: MessageHandlerService,
    private globalSettingsContextService: GlobalSettingsContextService,
    private fallback: BuiltInTranslations,
  ) {}

  getTranslation(lang: string): Observable<TranslationMap> {
    const languageMapPathPrefix = this.globalSettingsContextService.languageMapPathPrefix;

    if (languageMapPathPrefix != null) {
      this.messageHandlerService.traceGroup(
        'language',
        'Loading language map from config path: "' + languageMapPathPrefix + '"',
      );
      this.messageHandlerService.traceGroup('language', 'Loading language map: "' + lang + '"');
      const httpLoader = new TranslateHttpLoader(this.http, languageMapPathPrefix);
      return httpLoader.getTranslation(lang).pipe(
        // `TranslateHttpLoader` is typed `Observable<Object>` — it fetches whatever
        // JSON is at the configured path and does not inspect it. Naming the shape
        // here is the only place that knows what CEE asked for; nothing downstream
        // can check it, since a language map is arbitrary nesting either way.
        map((translations): TranslationMap => translations as TranslationMap),
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

  getBuiltInVersion(lang: string): Observable<TranslationMap> {
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
