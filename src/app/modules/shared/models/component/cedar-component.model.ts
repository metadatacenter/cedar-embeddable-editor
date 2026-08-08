import { LabelInfo } from '../info/label-info.model';
import { StaticFieldComponent } from '../static/static-field-component.model';

export interface CedarComponent {
  className: string;
  name: string;
  path: string[];
  /** The static field a component is paired with, or null when it has none — most do not. */
  linkedStaticFieldComponent: StaticFieldComponent | null;
  hidden?: boolean;

  labelInfo: LabelInfo;

  isMulti(): boolean;
  isMultiPage(): boolean;
}
