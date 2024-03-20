import { CedarComponent } from '../component/cedar-component.model';
import { ElementComponent } from '../component/element-component.model';
import { LabelInfo } from '../info/label-info.model';
import { StaticFieldComponent } from '../static/static-field-component.model';

export abstract class AbstractElementComponent implements ElementComponent {
  className = 'AbstractElementComponent';
  name: string;
  path: string[];
  children: CedarComponent[] = [];
  labelInfo: LabelInfo = new LabelInfo();
  linkedStaticFieldComponent: StaticFieldComponent = null;
  hidden: boolean;

  getChildByName(childName: string): CedarComponent {
    for (const child of this.children) {
      if (child.name === childName) {
        return child;
      }
    }
    return null;
  }

  abstract isMulti(): boolean;
  abstract isMultiPage(): boolean;
}
