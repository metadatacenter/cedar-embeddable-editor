import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'secureJson'})
export class SecureJsonPipe implements PipeTransform {

  transform(value: any): string {
    console.log('SecureJsonPipe.transform');
    return JSON.stringify(value);
  }

}
