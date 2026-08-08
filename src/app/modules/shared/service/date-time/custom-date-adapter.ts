import { Injectable } from '@angular/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import * as moment from 'moment';
import { DateTimeService } from './date-time.service';

@Injectable()
export class CustomDateAdapter extends MomentDateAdapter {
  constructor(private dateTimeService: DateTimeService) {
    super();
    // Material 22's MomentDateAdapter takes no constructor arguments; the locale
    // it used to accept there is now set through the method it always called
    // internally with it, so this is the same assignment by its own route.
    this.setLocale(dateTimeService.locale);
  }

  public override format(date: moment.Moment, _displayFormat: string): string {
    const locale = this.dateTimeService.locale;
    const format = this.dateTimeService.format;
    date.locale(locale);
    return date.format(format);
  }
}
