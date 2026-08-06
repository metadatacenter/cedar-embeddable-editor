import { LabelInfo } from '../info/label-info.model';
import { StaticFieldComponent } from '../static/static-field-component.model';

export interface CedarComponent {
  className: string;
  name: string;
  path: string[];
  linkedStaticFieldComponent: StaticFieldComponent;
  hidden?: boolean;

  labelInfo: LabelInfo;

  isMulti(): boolean;
  isMultiPage(): boolean;
}
