import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserPreferencesService {
  private _readOnlyMode = new BehaviorSubject<boolean>(false);

  readonly readOnlyMode$ = this._readOnlyMode.asObservable();

  setReadOnlyMode(value: boolean): void {
    this._readOnlyMode.next(value);
  }
}
