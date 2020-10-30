import {FieldComponent} from '../component/field-component.model';
import {MultiComponent} from '../component/multi-component.model';
import {MultiInfo} from '../info/multi-info.model';
import {CurrentMultiInfo} from '../info/current-multi-info.model';
import {AbstractFieldComponent} from './abstract-field-component.model';
import {DataObjectService} from '../../service/data-object.service';
import {JsonSchema} from '../json-schema.model';

export class MultiFieldComponent extends AbstractFieldComponent implements MultiComponent, FieldComponent {

  className = 'MultiFieldComponent';
  multiInfo: MultiInfo = new MultiInfo();
  currentMultiInfo: CurrentMultiInfo = new CurrentMultiInfo();

  getCurrentMultiCount(): number {
    return this.currentMultiInfo.count;
  }

  setCurrentMultiCount(currentIndex: number, dataObjectService: DataObjectService): void {
    this.currentMultiInfo.currentIndex = currentIndex;
    this.updateUIComponentToModel(dataObjectService);
  }

  isMulti(): boolean {
    return true;
  }

  hasMultiInstances(): boolean {
    return this.currentMultiInfo.count > 0;
  }

  public updateUIComponentToModel(dataObjectService: DataObjectService): void {
    // console.log('MultiFieldComponent.updateUIComponentToModel');
    const dataObject: object = dataObjectService.getDataPathNode(this.path);
    this.uiComponent.setCurrentValue(dataObject[this.currentMultiInfo.currentIndex][JsonSchema.atValue]);
  }
}
