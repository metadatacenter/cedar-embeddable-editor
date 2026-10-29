import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GlobalSettingsContextService {
  public terminologyBaseUrl: string | null = null;
  public static DEFAULT_LANGUAGE = 'en';
  public languageMapPathPrefix: string | null = null;
  /** The language each loaded map is written in, keyed by the language it was loaded for. */
  private readonly mapLanguages = new Map<string, string>();

  constructor() {}

  /** Record that the map loaded for `requested` is written in `written`. */
  recordMapLanguage(requested: string, written: string): void {
    this.mapLanguages.set(requested, written);
  }

  /** The language the map loaded for `requested` is written in, which is `requested` until a load says otherwise. */
  mapLanguage(requested: string): string {
    return this.mapLanguages.get(requested) ?? requested;
  }
}
