import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'rdf'})
export class RdfPipe implements PipeTransform {

  transform(value: object): string {
    return value.toString();
  }

}
