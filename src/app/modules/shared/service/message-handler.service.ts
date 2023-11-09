import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MessageHandlerService {
  private eventHandler = null;

  constructor() {}

  injectEventHandler(value: object): void {
    this.eventHandler = value;
  }

  trace(label: string): void {
    console.log('CEE TRACE: ' + label);
  }

  traceObject(label: string, value: object): void {
    console.log('CEE TRACE: ' + label);
    console.log(value);
  }

  error(label: string): void {
    console.error('CEE ERROR: ' + label);
  }

  errorObject(label: string, value: object): void {
    console.error('CEE ERROR: ' + label);
    console.error(value);
  }
}
