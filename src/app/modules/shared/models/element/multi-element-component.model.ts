import {MultiInfo} from '../info/multi-info.model';
import {ElementComponent} from '../component/element-component.model';
import {MultiComponent} from '../component/multi-component.model';
import {CurrentMultiInfo} from '../info/current-multi-info.model';
import {AbstractElementComponent} from './abstract-element-component.model';

export class MultiElementComponent extends AbstractElementComponent implements ElementComponent, MultiComponent {

  className = 'MultiElementComponent';
  multiInfo: MultiInfo = new MultiInfo();
  currentMultiInfo: CurrentMultiInfo = new CurrentMultiInfo();

  getCurrentMultiCount(): number {
    return this.currentMultiInfo.count;
  }

  setCurrentMultiCount(currentIndex: number): void {
    this.currentMultiInfo.currentIndex = currentIndex;
  }

  isMulti(): boolean {
    return true;
  }

  hasMultiInstances(): boolean {
    return this.currentMultiInfo.count > 0;
  }
}
