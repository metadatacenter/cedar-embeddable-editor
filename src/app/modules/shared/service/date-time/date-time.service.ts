import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DateTimeService {
  private formatString: string;

  public constructor() {
    this.formatString = 'MM/DD/YYYY';
  }

  public get format(): string {
    return this.formatString;
  }

  public set format(value: string) {
    this.formatString = value;
  }
}
