import { CedarComponent } from './cedar-component.model';
import { LabelInfo } from '../info/label-info.model';

export interface ElementComponent extends CedarComponent {
  children: CedarComponent[];
  labelInfo: LabelInfo;
  hidden: boolean;

  getChildByName(childName: string): CedarComponent;
}
