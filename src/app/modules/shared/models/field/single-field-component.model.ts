import {FieldComponent} from '../component/field-component.model';
import {SingleComponent} from '../component/single-component.model';
import {AbstractFieldComponent} from './abstract-field-component.model';

export class SingleFieldComponent extends AbstractFieldComponent implements SingleComponent, FieldComponent {

  className = 'SingleFieldComponent';

  isMulti(): boolean {
    return false;
  }

  isMultiPage(): boolean {
    return true;
  }

}
