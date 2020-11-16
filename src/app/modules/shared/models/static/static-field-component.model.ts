import {SingleComponent} from '../component/single-component.model';
import {LabelInfo} from '../info/label-info.model';
import {BasicInfo} from '../info/basic-info.model';

export class StaticFieldComponent implements SingleComponent {

  className = 'StaticFieldComponent';

  name: string;
  path: string[];
  labelInfo: LabelInfo = new LabelInfo();
  basicInfo: BasicInfo = new BasicInfo();

  isMulti(): boolean {
    return false;
  }
}
