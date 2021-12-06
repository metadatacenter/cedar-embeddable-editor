import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateTimeService {
  private _format: string;
  private _locale: string;

  public constructor() {
    this._format = "LL";
    this._locale = "en-US";
  }

  public get format(): string {
    return this._format;
  }

  public set format(value: string) {
    this._format = value;
  }

  public get locale(): string {
    return this._locale;
  }

  public set locale(value: string) {
    this._locale = value;
  }
}
