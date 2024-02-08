import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GlobalSettingsContextService {
  public languageMapPathPrefix = null;

  constructor() {}
}
