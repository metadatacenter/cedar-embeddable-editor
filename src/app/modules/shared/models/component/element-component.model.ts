import {CedarComponent} from './cedar-component.model';
import {LabelInfo} from '../info/label-info.model';

export interface ElementComponent extends CedarComponent {

  children: CedarComponent[];
  labelInfo: LabelInfo;

  getChildByName(childName: string): CedarComponent;

}
