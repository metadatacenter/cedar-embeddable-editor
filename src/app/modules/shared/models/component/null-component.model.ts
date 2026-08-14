import { CedarComponent } from './cedar-component.model';
import { LabelInfo } from '../info/label-info.model';

export class NullComponent implements CedarComponent {
  className = 'NullComponent';
  labelInfo: LabelInfo = new LabelInfo();
  name = '';
  path: string[] = [];
  hidden = false;
  hiddenInTemplate = false;

  isMulti(): boolean {
    return false;
  }

  isMultiPage(): boolean {
    return false;
  }
}
