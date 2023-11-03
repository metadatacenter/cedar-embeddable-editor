import { MultiInfo } from '../info/multi-info.model';
import { ElementComponent } from '../component/element-component.model';
import { MultiComponent } from '../component/multi-component.model';
import { AbstractElementComponent } from './abstract-element-component.model';

export class MultiElementComponent extends AbstractElementComponent implements ElementComponent, MultiComponent {
  className = 'MultiElementComponent';
  multiInfo: MultiInfo = new MultiInfo();

  isMulti(): boolean {
    return true;
  }

  isMultiPage(): boolean {
    return true;
  }
}
