import {Pipe, PipeTransform} from '@angular/core';
import {decycle} from 'json-cycle';

@Pipe({name: 'secureJson'})
export class SecureJsonPipe implements PipeTransform {

  transform(value: any): string {
    console.log('SecureJsonPipe.transform');
    return JSON.stringify(decycle(value));
  }

}
