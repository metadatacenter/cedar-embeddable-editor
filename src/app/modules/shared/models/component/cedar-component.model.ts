import {LabelInfo} from '../info/label-info.model';
import {DataObjectService} from '../../service/data-object.service';

export interface CedarComponent {

  className: string;
  name: string;
  path: string[];

  labelInfo: LabelInfo;

  isMulti(): boolean;

}
