import { SingleComponent } from '../component/single-component.model';
import { LabelInfo } from '../info/label-info.model';
import { BasicInfo } from '../info/basic-info.model';
import { ContentInfo } from '../info/content-info.model';

export class StaticFieldComponent implements SingleComponent {
  className = 'StaticFieldComponent';

  name = '';
  path: string[] = [];
  labelInfo: LabelInfo = new LabelInfo();
  basicInfo: BasicInfo = new BasicInfo();
  contentInfo: ContentInfo = new ContentInfo();
  hidden = false;
  hiddenInTemplate = false;

  isMulti(): boolean {
    return false;
  }

  isMultiPage(): boolean {
    return false;
  }
}
