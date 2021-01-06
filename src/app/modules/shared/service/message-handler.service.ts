import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MessageHandlerService {

  private eventHandler = null;

  constructor() {
  }

  injectEventHandler(value: object): void {
    this.eventHandler = value;
  }

  trace(label: string): void {
    console.log('TRACE: ' + label);
  }

  traceObject(label: string, value: object): void {
    console.log('TRACE: ' + label);
    console.log(value);
  }

  error(label: string): void {
    console.error('ERROR: ' + label);
  }

}
