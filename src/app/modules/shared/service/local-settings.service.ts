import {Injectable} from '@angular/core';
import {environment} from '../../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class LocalSettingsService {

    // keys
    private static LANGUAGE = 'language';

    constructor() {
    }

    public setLanguage(language: string): void {
        localStorage.setItem(LocalSettingsService.LANGUAGE, language);
    }

    public getLanguage(): string {
        return localStorage.getItem(LocalSettingsService.LANGUAGE) ?? environment.defaultLanguage;
    }
}
