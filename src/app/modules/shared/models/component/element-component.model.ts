import { CedarComponent } from './cedar-component.model';
import { LabelInfo } from '../info/label-info.model';

export interface ElementComponent extends CedarComponent {
  children: CedarComponent[];
  labelInfo: LabelInfo;

  /** Null when the element has no child of that name. */
  getChildByName(childName: string): CedarComponent | null;
}
