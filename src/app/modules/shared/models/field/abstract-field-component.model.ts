import { FieldComponent } from '../component/field-component.model';
import { BasicInfo } from '../info/basic-info.model';
import { ValueInfo } from '../info/value-info.model';
import { NumberInfo } from '../info/number-info.model';
import { ChoiceInfo } from '../info/choice-info.model';
import { LabelInfo } from '../info/label-info.model';
import { StaticFieldComponent } from '../static/static-field-component.model';
import { ControlledInfo } from '../info/controlled-info.model';
import { MultiInfo } from '../info/multi-info.model';

export abstract class AbstractFieldComponent implements FieldComponent {
  className = 'AbstractFieldComponent';
  name = '';
  path: string[] = [];
  basicInfo: BasicInfo = new BasicInfo();
  valueInfo: ValueInfo = new ValueInfo();
  numberInfo: NumberInfo = new NumberInfo();
  choiceInfo: ChoiceInfo = new ChoiceInfo();
  labelInfo: LabelInfo = new LabelInfo();
  linkedStaticFieldComponent: StaticFieldComponent | null = null;
  controlledInfo: ControlledInfo = new ControlledInfo();
  multiInfo: MultiInfo = new MultiInfo();
  hidden = false;
  /**
   * The template said `_ui.hidden`, which is permanent.
   *
   * Distinct from `hidden`, which the read-only viewer also writes when a field
   * is empty. One boolean cannot carry both: a template-hidden field holding a
   * value would be un-hidden the moment the empty-field pass ran over it.
   */
  hiddenInTemplate = false;

  abstract isMulti(): boolean;
  abstract isMultiPage(): boolean;
}
