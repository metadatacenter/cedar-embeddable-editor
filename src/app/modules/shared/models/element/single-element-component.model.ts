import {ElementComponent} from '../component/element-component.model';
import {SingleComponent} from '../component/single-component.model';
import {AbstractElementComponent} from './abstract-element-component.model';

export class SingleElementComponent extends AbstractElementComponent implements SingleComponent, ElementComponent {

  className = 'SingleElementComponent';

  isMulti(): boolean {
    return false;
  }

}
