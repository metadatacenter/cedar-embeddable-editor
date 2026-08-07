import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'rdf',
    standalone: false
})
export class RdfPipe implements PipeTransform {
  transform(value: object): string {
    return value.toString();
  }
}
