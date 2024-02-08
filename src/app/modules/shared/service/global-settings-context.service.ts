import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GlobalSettingsContextService {
  public static DEFAULT_LANGUAGE = 'en';
  public languageMapPathPrefix = null;

  constructor() {}
}
