import {CedarComponent} from './cedar-component.model';
import {LabelInfo} from '../info/label-info.model';

export class NullComponent implements CedarComponent {

  className = 'NullComponent';
  labelInfo: LabelInfo;
  name: string;
  path: string[];

  isMulti(): boolean {
    return false;
  }

}
