import {CedarComponent} from './cedar-component.model';
import {MultiInfo} from '../info/multi-info.model';
import {CurrentMultiInfo} from '../info/current-multi-info.model';
import {DataObjectService} from '../../service/data-object.service';

export interface MultiComponent extends CedarComponent {

  multiInfo: MultiInfo;
  currentMultiInfo: CurrentMultiInfo;
  name: string;

  getCurrentMultiCount(): number;

  setCurrentMultiCount(firstIndex: number, dataObjectService: DataObjectService): void;

  hasMultiInstances(): boolean;
}
