import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DateTimeService {
  private formatString: string;
  private localeString: string;

  public constructor() {
    this.formatString = 'LL';
    this.localeString = 'en-US';
  }

  public get format(): string {
    return this.formatString;
  }

  public set format(value: string) {
    this.formatString = value;
  }

  public get locale(): string {
    return this.localeString;
  }

  public set locale(value: string) {
    this.localeString = value;
  }
}
