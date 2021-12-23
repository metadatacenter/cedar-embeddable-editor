import {CedarComponent} from './cedar-component.model';
import {LabelInfo} from '../info/label-info.model';
import {StaticFieldComponent} from '../static/static-field-component.model';

export class NullComponent implements CedarComponent {

  className = 'NullComponent';
  labelInfo: LabelInfo;
  name: string;
  path: string[];
  linkedStaticFieldComponent: StaticFieldComponent;

  isMulti(): boolean {
    return false;
  }


}
