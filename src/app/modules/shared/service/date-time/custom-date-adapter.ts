import { Injectable } from '@angular/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import * as moment from 'moment';
import { DateTimeService } from './date-time.service';

@Injectable()
export class CustomDateAdapter extends MomentDateAdapter {
  constructor(private dateTimeService: DateTimeService) {
    super(dateTimeService.locale);
  }

  public format(date: moment.Moment, displayFormat: string): string {
    const locale = this.dateTimeService.locale;
    const format = this.dateTimeService.format;
    date.locale(locale);
    return date.format(format);
  }
}
