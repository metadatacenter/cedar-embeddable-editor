import {CedarComponent} from '../component/cedar-component.model';
import {ElementComponent} from '../component/element-component.model';
import {SingleComponent} from '../component/single-component.model';

export class SingleElementComponent implements SingleComponent, ElementComponent {

  className = 'SingleElementComponent';
  name: string;
  children: CedarComponent[] = [];

}
