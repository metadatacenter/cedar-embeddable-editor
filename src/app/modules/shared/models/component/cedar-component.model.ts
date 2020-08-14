import {LabelInfo} from '../info/label-info.model';

export interface CedarComponent {

  className: string;
  name: string;
  path: string[];

  labelInfo: LabelInfo;

  isMulti(): boolean;
}
