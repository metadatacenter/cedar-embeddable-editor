import {CedarComponent} from '../component/cedar-component.model';
import {ElementComponent} from '../component/element-component.model';
import {LabelInfo} from '../info/label-info.model';

export abstract class AbstractElementComponent implements ElementComponent {

  className = 'AbstractElementComponent';
  name: string;
  path: string[];
  children: CedarComponent[] = [];
  labelInfo: LabelInfo = new LabelInfo();

  getChildByName(childName: string): CedarComponent {
    for (const child of this.children) {
      if (child.name === childName) {
        return child;
      }
    }
    return null;
  }

}
