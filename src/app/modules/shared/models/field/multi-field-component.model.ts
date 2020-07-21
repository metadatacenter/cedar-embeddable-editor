import {FieldComponent} from '../component/field-component.model';
import {MultiComponent} from '../component/multi-component.model';
import {MultiInfo} from '../info/multi-info.model';
import {BasicInfo} from '../info/basic-info.model';
import {ValueInfo} from '../info/value-info.model';
import {NumberInfo} from '../info/number-info.model';
import {ChoiceInfo} from '../info/choice-info.model';
import {LabelInfo} from '../info/label-info.model';

export class MultiFieldComponent implements MultiComponent, FieldComponent {

  className = 'MultiFieldComponent';
  name: string;
  multiInfo: MultiInfo = new MultiInfo();
  basicInfo: BasicInfo = new BasicInfo();
  valueInfo: ValueInfo = new ValueInfo();
  numberInfo: NumberInfo = new NumberInfo();
  choiceInfo: ChoiceInfo = new ChoiceInfo();
  labelInfo: LabelInfo = new LabelInfo();

}
