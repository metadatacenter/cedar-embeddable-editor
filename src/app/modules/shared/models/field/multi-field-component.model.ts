import {FieldComponent} from '../component/field-component.model';
import {MultiComponent} from '../component/multi-component.model';
import {MultiInfo} from '../info/multi-info.model';
import {CurrentMultiInfo} from '../info/current-multi-info.model';
import {AbstractFieldComponent} from './abstract-field-component.model';

export class MultiFieldComponent extends AbstractFieldComponent implements MultiComponent, FieldComponent {

  className = 'MultiFieldComponent';
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
