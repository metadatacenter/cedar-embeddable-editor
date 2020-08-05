import {CedarComponent} from './cedar-component.model';
import {MultiInfo} from '../info/multi-info.model';
import {CurrentMultiInfo} from '../info/current-multi-info.model';

export interface MultiComponent extends CedarComponent {

  multiInfo: MultiInfo;
  currentMultiInfo: CurrentMultiInfo;
  name: string;

}
