import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';
import { DateTimeService } from './date-time.service';

@Injectable()
export class CustomDateAdapter extends NativeDateAdapter {
  constructor(private readonly dateTimeService: DateTimeService) {
    super();
  }

  public override format(date: Date, _displayFormat: object): string {
    if (!this.isValid(date)) {
      throw Error('CustomDateAdapter: Cannot format invalid date.');
    }
    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    if (this.dateTimeService.format === 'YYYY') {
      return year;
    }
    if (this.dateTimeService.format === 'MM/YYYY') {
      return `${month}/${year}`;
    }
    return `${month}/${day}/${year}`;
  }
}
