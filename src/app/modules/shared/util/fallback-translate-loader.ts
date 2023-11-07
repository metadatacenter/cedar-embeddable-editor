import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { catchError } from 'rxjs/operators';

export class FallbackTranslateLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    private fallback: object,
  ) {}

  getTranslation(lang: string): Observable<any> {
    console.log('Loading language map:' + lang);
    const httpLoader = new TranslateHttpLoader(this.http, '/assets/i18n-cee/');

    return httpLoader.getTranslation(lang).pipe(
      catchError((err) => {
        console.log('External language map not found, using built-in version.');
        if (Object.hasOwn(this.fallback, lang)) {
          return Promise.resolve(this.fallback[lang]);
        } else {
          return Promise.resolve(null);
        }
      }),
    );
  }
}
