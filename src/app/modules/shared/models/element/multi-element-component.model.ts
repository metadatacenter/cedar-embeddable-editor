import {CedarComponent} from '../component/cedar-component.model';
import {MultiInfo} from '../info/multi-info.model';
import {ElementComponent} from '../component/element-component.model';
import {MultiComponent} from '../component/multi-component.model';
import {LabelInfo} from '../info/label-info.model';

export class MultiElementComponent implements ElementComponent, MultiComponent {

  className = 'MultiElementComponent';
  name: string;
  children: CedarComponent[] = [];
  multiInfo: MultiInfo = new MultiInfo();
  labelInfo: LabelInfo = new LabelInfo();

}
