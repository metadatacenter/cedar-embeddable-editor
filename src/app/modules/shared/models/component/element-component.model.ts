import { CedarComponent } from './cedar-component.model';
import { LabelInfo } from '../info/label-info.model';

export interface ElementComponent extends CedarComponent {
  children: CedarComponent[];
  labelInfo: LabelInfo;
  hidden: boolean;
  /** The template said `_ui.hidden`; permanent, unlike `hidden`. */
  hiddenInTemplate: boolean;

  /** Null when the element has no child of that name. */
  getChildByName(childName: string): CedarComponent | null;
}
