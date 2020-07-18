import {CedarComponent} from './cedar-component.model';
import {MultiInfo} from '../info/multi-info.model';

export interface MultiComponent extends CedarComponent {

  multiInfo: MultiInfo;
  name: string;

}
