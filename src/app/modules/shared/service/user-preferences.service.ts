import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UserPreferencesService {
  private _readOnlyMode = new BehaviorSubject<boolean>(false);

  readonly readOnlyMode$ = this._readOnlyMode.asObservable();

  setReadOnlyMode(value: boolean): void {
    // console.log('Value:', value);
    this._readOnlyMode.next(value);
    // console.log('ReadOnlyMode', this.readOnlyMode$.subscribe());
    // this.readOnlyMode$.subscribe((value) => console.log('Value', value));
  }
}
