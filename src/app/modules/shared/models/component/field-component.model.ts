import { CedarComponent } from './cedar-component.model';
import { BasicInfo } from '../info/basic-info.model';
import { ValueInfo } from '../info/value-info.model';
import { NumberInfo } from '../info/number-info.model';
import { ChoiceInfo } from '../info/choice-info.model';
import { LabelInfo } from '../info/label-info.model';
import { ControlledInfo } from '../info/controlled-info.model';
import { MultiInfo } from '../info/multi-info.model';

export interface FieldComponent extends CedarComponent {
  basicInfo: BasicInfo;
  valueInfo: ValueInfo;
  numberInfo: NumberInfo;
  choiceInfo: ChoiceInfo;
  labelInfo: LabelInfo;
  controlledInfo: ControlledInfo;
  multiInfo: MultiInfo;
  hidden: boolean;

  isMulti(): boolean;
  isMultiPage(): boolean;
}
